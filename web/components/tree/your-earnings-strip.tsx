"use client";

import { useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, Lock, Loader2, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCampaign, usePortfolio } from "@/lib/api/hooks";
import { adaptMyEarningsForCampaign } from "@/lib/api/adapters";
import { useHiveworkProgram } from "@/lib/anchor/program";
import {
  claimLeafPayoutOnchain,
  claimPayoutOnchain,
} from "@/lib/anchor/tx";
import type {
  MyContribution,
  MyCampaignEarnings,
} from "@/lib/mocks/my-earnings";

type Props = {
  campaignId: string;
};

const LEVEL_LABEL: Record<number, string> = {
  1: "L1 · Hook",
  2: "L2 · Audio",
  3: "L3 · Visual",
  4: "Leaf · Post",
};

/**
 * Per-campaign Withdraw entry-point. Sits between the stats strip and the
 * tree on /c/[id]. Shows the connected wallet's accrued USDC + locked SOL
 * stake, and opens a modal to claim the payout / release the stake once the
 * campaign hits the right state (mirrors the on-chain release rules from
 * CLAUDE.md). Wallet not connected → renders a thin connect prompt instead.
 */
export function YourEarningsStrip({ campaignId }: Props) {
  const { publicKey } = useWallet();
  const [open, setOpen] = useState(false);

  const address = publicKey?.toBase58();
  const { data: portfolio } = usePortfolio(address);
  const { data: campaignDetail } = useCampaign(campaignId);
  // Once TreeView's close-and-distribute is the source of truth we'll lift
  // this up; for now the api's campaign.status drives it via the adapter.
  const earnings = useMemo(() => {
    if (!portfolio || !campaignDetail) return null;
    return adaptMyEarningsForCampaign(portfolio, campaignDetail, campaignId);
  }, [portfolio, campaignDetail, campaignId]);

  // Wallet not connected → still surface that there's a per-campaign claim
  // flow, but hide the numbers (we wouldn't know whose they are).
  if (!publicKey) {
    return (
      <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line/80 bg-surface/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2">
            <Wallet className="h-3.5 w-3.5 text-muted" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-medium">
              Connect to see your earnings
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              claim payouts · release stake
            </span>
          </div>
        </div>
        <WalletConnectButton />
      </section>
    );
  }

  // Connected, but no contributions in this campaign → render a friendly
  // empty-state nudging towards publishing. Stays at the same vertical slot
  // so the layout doesn't jump.
  if (!earnings) {
    return (
      <section className="mt-3 flex items-center gap-2.5 rounded-lg border border-dashed border-line/80 bg-surface/40 px-4 py-2.5 text-[13px] text-fg-soft">
        <Sparkles className="h-3.5 w-3.5 text-muted" />
        <span>
          You haven&apos;t earned in this campaign yet — publish a post to start
          accruing.
        </span>
      </section>
    );
  }

  const isClosed = earnings.campaignStatus === "closed";
  const closesInDays = Math.floor(earnings.closesInHours / 24);
  const closesInHours = earnings.closesInHours % 24;

  return (
    <>
      <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-honey/40 bg-honey/[0.04] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-honey/40 bg-honey/10">
              <Coins className="h-3.5 w-3.5 text-honey" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                your earnings
              </span>
              <span className="font-mono text-base font-bold tabular text-honey">
                ${earnings.pendingUsdc.toFixed(2)}
              </span>
            </div>
          </div>

          <span aria-hidden className="hidden h-7 w-px bg-line md:block" />

          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface-2">
              <Lock className="h-3.5 w-3.5 text-muted" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                stake locked
              </span>
              <span className="font-mono text-base font-bold tabular text-foreground">
                {earnings.stakeSol.toFixed(4)} SOL
              </span>
            </div>
          </div>

          <span aria-hidden className="hidden h-7 w-px bg-line md:block" />

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              across
            </span>
            <span className="font-mono text-[13px] font-semibold tabular">
              {earnings.contributions.length} node
              {earnings.contributions.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-faint sm:inline">
            {isClosed
              ? "campaign closed · claimable"
              : `claimable when campaign closes · ${closesInDays}d ${closesInHours}h left`}
          </span>
          <Button
            variant={isClosed ? "honey" : "outline"}
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Coins className="h-3.5 w-3.5" />
            Withdraw
          </Button>
        </div>
      </section>

      <WithdrawDialog
        open={open}
        onOpenChange={setOpen}
        earnings={earnings}
        campaignId={campaignId}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                              */
/* ------------------------------------------------------------------ */

function WithdrawDialog({
  open,
  onOpenChange,
  earnings,
  campaignId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  earnings: MyCampaignEarnings;
  campaignId: string;
}) {
  const { publicKey } = useWallet();
  const program = useHiveworkProgram();
  const { data: portfolio } = usePortfolio(publicKey?.toBase58());
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const isClosed = earnings.campaignStatus === "closed";
  const canClaim = isClosed && earnings.claimableUsdc > 0;
  const canRelease = isClosed && earnings.releasableStakeSol > 0;

  const closesInDays = Math.floor(Math.max(earnings.closesInHours, 0) / 24);
  const closesInHoursMod = Math.max(earnings.closesInHours, 0) % 24;

  // Single Anchor flow: claim_payout / claim_leaf_payout transfers the
  // accrued USDC AND releases the locked stake atomically when the node had
  // ≥1 conversion. So "Claim" and "Release stake" both route through this.
  async function executeClaim(): Promise<{ sigs: string[]; skipped: number }> {
    if (!program || !publicKey || !portfolio) {
      throw new Error("Wallet not connected");
    }
    const row = portfolio.pendingByCampaign.find(
      (r) => r.campaignId === campaignId
    );
    if (!row?.campaignOnchainPda) {
      throw new Error("Campaign is not finalized on-chain");
    }
    const usdcMintStr = process.env.NEXT_PUBLIC_USDC_MINT;
    if (!usdcMintStr) throw new Error("Missing NEXT_PUBLIC_USDC_MINT");
    const usdcMint = new PublicKey(usdcMintStr);
    const campaign = new PublicKey(row.campaignOnchainPda);

    const nodePdas = new Map<string, string>();
    const leafPdas = new Map<string, string>();
    for (const n of portfolio.nodes) {
      if (n.campaignId === campaignId && n.onchainPda) {
        nodePdas.set(n.id, n.onchainPda);
      }
    }
    for (const l of portfolio.leaves) {
      if (l.campaignId === campaignId && l.onchainPda) {
        leafPdas.set(l.id, l.onchainPda);
      }
    }

    const sigs: string[] = [];
    let skipped = 0;
    for (const b of row.breakdown) {
      if (Number(b.pendingUsdc) <= 0) {
        skipped++;
        continue;
      }
      if (b.kind === "node") {
        const pda = nodePdas.get(b.contributionId);
        if (!pda) {
          skipped++;
          continue;
        }
        const { signature } = await claimPayoutOnchain(program, {
          node: new PublicKey(pda),
          campaign,
          usdcMint,
          creator: publicKey,
        });
        sigs.push(signature);
      } else {
        const pda = leafPdas.get(b.contributionId);
        if (!pda) {
          skipped++;
          continue;
        }
        const { signature } = await claimLeafPayoutOnchain(program, {
          leaf: new PublicKey(pda),
          campaign,
          usdcMint,
          creator: publicKey,
        });
        sigs.push(signature);
      }
    }
    await queryClient.invalidateQueries({
      queryKey: ["wallets", publicKey.toBase58(), "portfolio"],
    });
    return { sigs, skipped };
  }

  async function handleClaim() {
    setClaiming(true);
    try {
      const { sigs } = await executeClaim();
      if (sigs.length === 0) {
        toast.message("Nothing to claim");
      } else {
        toast.success(`Claimed $${earnings.claimableUsdc.toFixed(2)} USDC`, {
          description: `${sigs.length} tx · ${sigs[0].slice(0, 8)}…`,
        });
      }
      onOpenChange(false);
    } catch (err) {
      console.error("claim failed", err);
      toast.error(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  async function handleRelease() {
    // Stake release happens inside claim_payout — same tx as the USDC claim.
    setReleasing(true);
    try {
      const { sigs } = await executeClaim();
      if (sigs.length === 0) {
        toast.message("No stake to release (already settled)");
      } else {
        toast.success(
          `Released ${earnings.releasableStakeSol.toFixed(4)} SOL stake`,
          { description: `${sigs.length} tx · ${sigs[0].slice(0, 8)}…` }
        );
      }
      onOpenChange(false);
    } catch (err) {
      console.error("release failed", err);
      toast.error(err instanceof Error ? err.message : "Release failed");
    } finally {
      setReleasing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Withdraw from {earnings.brand}</DialogTitle>
          <DialogDescription>
            Your accrued payouts and stake across{" "}
            {earnings.contributions.length} owned node
            {earnings.contributions.length === 1 ? "" : "s"} in this campaign.
          </DialogDescription>
        </DialogHeader>

        {/* Earnings section */}
        <section className="rounded-lg border border-line bg-surface-2/40">
          <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Coins className="h-3.5 w-3.5 text-honey" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                Earnings · USDC
              </span>
            </div>
            {isClosed ? (
              <span className="rounded-full border border-honey/40 bg-honey/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-honey">
                claimable
              </span>
            ) : (
              <span className="rounded-full border border-live/40 bg-live/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-live">
                accruing
              </span>
            )}
          </header>
          <div className="flex items-end justify-between gap-4 px-4 py-3">
            <div>
              <span className="font-mono text-3xl font-semibold tabular text-honey">
                ${earnings.pendingUsdc.toFixed(2)}
              </span>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {isClosed
                  ? "Final payout — withdraw any time."
                  : `Locked until campaign closes (in ${closesInDays}d ${closesInHoursMod}h). Claim is enabled then.`}
              </p>
            </div>
            <Button
              variant="honey"
              size="sm"
              onClick={handleClaim}
              disabled={!canClaim || claiming}
              title={
                canClaim
                  ? "Withdraw your USDC payout"
                  : "Available once the campaign closes"
              }
            >
              {claiming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Coins className="h-3.5 w-3.5" />
              )}
              {claiming ? "Claiming…" : "Claim"}
            </Button>
          </div>
        </section>

        {/* Stake section */}
        <section className="rounded-lg border border-line bg-surface-2/40">
          <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                Stake · SOL
              </span>
            </div>
            <span className="font-mono text-[10px] tabular text-muted">
              total {earnings.stakeSol.toFixed(4)} SOL
            </span>
          </header>

          <ul className="divide-y divide-line/60">
            {earnings.contributions.map((c) => (
              <ContributionRow key={c.nodeId} c={c} />
            ))}
          </ul>

          <footer className="flex items-end justify-between gap-4 border-t border-line px-4 py-3">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-muted">
                releasable
              </span>
              <div className="font-mono text-lg font-semibold tabular text-foreground">
                {earnings.releasableStakeSol.toFixed(4)} SOL
                {earnings.forfeitStakeSol > 0 && (
                  <span className="ml-2 font-mono text-[11px] font-normal text-faint">
                    · {earnings.forfeitStakeSol.toFixed(4)} forfeit
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted">
                {isClosed
                  ? "Stakes on nodes that converted are returned to you. Stakes on nodes with no conversions are redistributed to successful paths."
                  : "Stakes release at campaign close. Nodes (or descendants) with ≥1 conversion get their SOL back; the rest is redistributed."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRelease}
              disabled={!canRelease || releasing}
              title={
                canRelease
                  ? "Release SOL stake from converting nodes"
                  : "Available once the campaign closes"
              }
            >
              {releasing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {releasing ? "Releasing…" : "Release stake"}
            </Button>
          </footer>
        </section>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContributionRow({ c }: { c: MyContribution }) {
  const statusStyles: Record<MyContribution["stakeStatus"], string> = {
    locked: "border-line/80 bg-surface-2 text-muted",
    releasable: "border-honey/40 bg-honey/10 text-honey",
    forfeit: "border-sting/40 bg-sting/10 text-sting",
  };
  const statusLabel: Record<MyContribution["stakeStatus"], string> = {
    locked: "locked",
    releasable: "releasable",
    forfeit: "forfeit",
  };

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
        {LEVEL_LABEL[c.level] ?? `L${c.level}`}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px]" title={c.title}>
        {c.title}
      </span>
      <span className="font-mono text-[11px] tabular text-muted">
        {c.conversions} conv
      </span>
      <span className="font-mono text-[12px] font-semibold tabular text-foreground">
        {c.stakeSol.toFixed(4)} SOL
      </span>
      <span
        className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${statusStyles[c.stakeStatus]}`}
      >
        {statusLabel[c.stakeStatus]}
      </span>
    </li>
  );
}
