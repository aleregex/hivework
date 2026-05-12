"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Hammer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCampaignConversions } from "@/lib/api/hooks";
import { useHiveworkProgram } from "@/lib/anchor/program";
import {
  closeAndDistributeOnchain,
  closeCampaignOnchain,
  deriveConversionPda,
  withdrawUnusedUsdcOnchain,
} from "@/lib/anchor/tx";

/**
 * Brand-only controls to wind a campaign down once its deadline is reached:
 *   1. "Close & distribute" — loops the campaign's conversions one tx at a
 *      time, invoking close_and_distribute for each. The first tx flips
 *      campaign.is_closed; subsequent calls just settle payouts. Idempotent.
 *   2. "Withdraw unused USDC" — pulls any escrow USDC that wasn't assigned to
 *      a winner back to the brand wallet. Only callable after every
 *      conversion has been processed.
 *
 * Visible only when the connected wallet matches `creatorWallet` and the
 * campaign is on-chain. The deadline check is enforced on-chain — we surface
 * the action and let the contract error if it's still too early.
 */
type Props = {
  campaignId: string;
  campaignOnchainPda: string | null;
  campaignCreatorWallet: string;
  campaignStatus: "draft" | "active" | "closed";
};

function pad16(s: string): Uint8Array {
  const buf = new Uint8Array(16);
  const enc = new TextEncoder().encode(s.slice(0, 16));
  buf.set(enc);
  return buf;
}

export function CloseCampaignControls({
  campaignId,
  campaignOnchainPda,
  campaignCreatorWallet,
  campaignStatus,
}: Props) {
  const { publicKey } = useWallet();
  const program = useHiveworkProgram();
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const isBrandOwner =
    publicKey?.toBase58() === campaignCreatorWallet && Boolean(publicKey);

  const { data: conversionsResp } = useCampaignConversions(campaignId, {
    enabled: isBrandOwner && Boolean(campaignOnchainPda),
  });

  if (!isBrandOwner || !campaignOnchainPda) return null;

  const total = conversionsResp?.conversions.length ?? 0;
  const isClosed = campaignStatus === "closed";

  async function handleCloseAndDistribute() {
    if (!program || !publicKey || !conversionsResp) {
      toast.error("Wallet not connected or campaign data missing");
      return;
    }
    if (!campaignOnchainPda) {
      toast.error("Campaign not on-chain");
      return;
    }
    const campaign = new PublicKey(campaignOnchainPda);

    setClosing(true);
    let processed = 0;
    let skipped = 0;
    try {
      if (!isClosed) {
        try {
          await closeCampaignOnchain(program, { campaign, authority: publicKey });
        } catch (err) {
          console.error("close_campaign explicitly failed", err);
          // We can ignore some errors here if it was already closed, but the
          // Rust side handles it gracefully.
        }
      }

      for (const c of conversionsResp.conversions) {
        const leaf = new PublicKey(c.leafPda);
        const idBytes = pad16(c.conversionIdSeed);
        const [conversionPda] = deriveConversionPda(campaign, leaf, idBytes);

        try {
          await closeAndDistributeOnchain(program, {
            campaign,
            conversion: conversionPda,
            leaf,
            nodeL1: new PublicKey(c.nodeL1Pda),
            nodeL2: new PublicKey(c.nodeL2Pda),
            nodeL3: new PublicKey(c.nodeL3Pda),
            authority: publicKey,
          });
          processed++;
        } catch (err) {
          // Re-running close_and_distribute on a conversion already processed
          // hits ConversionAlreadyRegistered. That's a no-op for us — keep going.
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.toLowerCase().includes("alreadyregistered")) {
            skipped++;
            continue;
          }
          throw err;
        }
      }
      toast.success(
        processed === 0
          ? "Campaign closed (no new conversions to distribute)"
          : `Distributed ${processed} conversion${processed === 1 ? "" : "s"}`,
        {
          description:
            skipped > 0 ? `${skipped} already settled · skipped` : undefined,
        },
      );
      await queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "conversions"],
      });
    } catch (err) {
      console.error("close_and_distribute failed", err);
      toast.error(
        err instanceof Error ? err.message : "Close & distribute failed",
        {
          description:
            processed > 0
              ? `Partial: ${processed} settled before the error`
              : undefined,
        },
      );
    } finally {
      setClosing(false);
    }
  }

  async function handleWithdrawUnused() {
    if (!program || !publicKey) {
      toast.error("Wallet not connected");
      return;
    }
    if (!campaignOnchainPda) {
      toast.error("Campaign not on-chain");
      return;
    }
    const usdcMintStr = process.env.NEXT_PUBLIC_USDC_MINT;
    if (!usdcMintStr) {
      toast.error("Missing NEXT_PUBLIC_USDC_MINT");
      return;
    }
    setWithdrawing(true);
    try {
      const { signature } = await withdrawUnusedUsdcOnchain(program, {
        campaign: new PublicKey(campaignOnchainPda),
        usdcMint: new PublicKey(usdcMintStr),
        authority: publicKey,
      });
      toast.success("Withdrew unused USDC", {
        description: `tx ${signature.slice(0, 8)}…`,
      });
      await queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId],
      });
    } catch (err) {
      console.error("withdraw_unused_usdc failed", err);
      toast.error(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-honey/40 bg-honey/[0.04] px-4 py-3">
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-honey">
          brand controls
        </span>
        <span className="text-[13px] text-fg-soft">
          {isClosed
            ? `Campaign closed · ${total} on-chain conversion${total === 1 ? "" : "s"} to settle`
            : `Close window when ready · ${total} pending conversion${total === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCloseAndDistribute}
          disabled={closing || withdrawing}
          title="Run close_and_distribute for every pushed conversion"
        >
          {closing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Hammer className="h-3.5 w-3.5" />
          )}
          {closing ? "Closing…" : "Close & distribute"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleWithdrawUnused}
          disabled={!isClosed || closing || withdrawing}
          title={
            isClosed
              ? "Pull any USDC not assigned to a winner back to your wallet"
              : "Available after close_and_distribute settles every conversion"
          }
        >
          {withdrawing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wallet className="h-3.5 w-3.5" />
          )}
          {withdrawing ? "Withdrawing…" : "Withdraw unused"}
        </Button>
      </div>
    </section>
  );
}
