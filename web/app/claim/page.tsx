"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Coins, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortfolio } from "@/lib/api/hooks";
import {
  adaptPortfolioClaimed,
  adaptPortfolioLifetime,
  adaptPortfolioPending,
} from "@/lib/api/adapters";
import { useHiveworkProgram } from "@/lib/anchor/program";
import {
  claimLeafPayoutOnchain,
  claimPayoutOnchain,
} from "@/lib/anchor/tx";

export default function ClaimPage() {
  const { publicKey } = useWallet();
  const program = useHiveworkProgram();
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState<string | null>(null);

  const { data: portfolio } = usePortfolio(publicKey?.toBase58());
  const pending = portfolio ? adaptPortfolioPending(portfolio) : [];
  const claimed = portfolio ? adaptPortfolioClaimed(portfolio) : [];
  const lifetime = portfolio ? adaptPortfolioLifetime(portfolio) : 0;

  async function claim(campaignId: string, amount: number) {
    if (!program || !publicKey || !portfolio) {
      toast.error("Connect your wallet first");
      return;
    }
    const row = portfolio.pendingByCampaign.find(
      (r) => r.campaignId === campaignId
    );
    if (!row?.campaignOnchainPda) {
      toast.error("Campaign not on-chain yet");
      return;
    }
    const usdcMintStr = process.env.NEXT_PUBLIC_USDC_MINT;
    if (!usdcMintStr) {
      toast.error("Missing NEXT_PUBLIC_USDC_MINT");
      return;
    }
    const usdcMint = new PublicKey(usdcMintStr);
    const campaign = new PublicKey(row.campaignOnchainPda);

    // Resolve every contribution (node/leaf) the wallet owns in this campaign
    // and execute one Anchor tx per claimable PDA. The contract claims a single
    // node/leaf at a time, so we iterate.
    const ownedNodePdas = new Map<string, string>(); // contributionId → pda
    const ownedLeafPdas = new Map<string, string>();
    for (const n of portfolio.nodes) {
      if (n.campaignId === campaignId && n.onchainPda) {
        ownedNodePdas.set(n.id, n.onchainPda);
      }
    }
    for (const l of portfolio.leaves) {
      if (l.campaignId === campaignId && l.onchainPda) {
        ownedLeafPdas.set(l.id, l.onchainPda);
      }
    }

    const sigs: string[] = [];
    setClaiming(campaignId);
    try {
      for (const b of row.breakdown) {
        if (Number(b.pendingUsdc) <= 0) continue;
        if (b.kind === "node") {
          const pda = ownedNodePdas.get(b.contributionId);
          if (!pda) continue;
          const { signature } = await claimPayoutOnchain(program, {
            node: new PublicKey(pda),
            campaign,
            usdcMint,
            creator: publicKey,
          });
          sigs.push(signature);
        } else {
          const pda = ownedLeafPdas.get(b.contributionId);
          if (!pda) continue;
          const { signature } = await claimLeafPayoutOnchain(program, {
            leaf: new PublicKey(pda),
            campaign,
            usdcMint,
            creator: publicKey,
          });
          sigs.push(signature);
        }
      }

      if (sigs.length === 0) {
        toast.message("Nothing to claim for this campaign");
      } else {
        toast.success(`Claimed $${amount.toFixed(2)} USDC`, {
          description: `${sigs.length} tx confirmed · ${sigs[0].slice(0, 8)}…`,
        });
      }
      await queryClient.invalidateQueries({
        queryKey: ["wallets", publicKey.toBase58(), "portfolio"],
      });
    } catch (err) {
      console.error("claim failed", err);
      toast.error("Claim failed", {
        description:
          err instanceof Error ? err.message : "Unknown error — see console.",
      });
    } finally {
      setClaiming(null);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-honey">
          Your earnings
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">Claim payouts</h1>
        <p className="max-w-2xl text-muted">
          Every campaign where your contributions generated conversions has a
          balance waiting for you. Active campaigns accrue, closed ones are
          claimable.
        </p>
      </div>

      {/* Lifetime stat */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-start gap-1 p-5">
            <span className="text-[10px] uppercase tracking-wider text-muted">
              Lifetime earnings
            </span>
            <span className="font-mono text-2xl font-semibold text-honey">
              ${lifetime.toFixed(2)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-start gap-1 p-5">
            <span className="text-[10px] uppercase tracking-wider text-muted">
              Pending across campaigns
            </span>
            <span className="font-mono text-2xl font-semibold">
              ${pending.reduce((sum, p) => sum + p.pendingUsdc, 0).toFixed(2)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-start gap-1 p-5">
            <span className="text-[10px] uppercase tracking-wider text-muted">
              Connected wallet
            </span>
            <span className="truncate font-mono text-xs">
              {publicKey?.toBase58() ?? "— not connected —"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Pending payouts */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Pending</h2>
        <div className="mt-3 grid gap-3">
          {pending.map((p) => (
            <Card key={p.campaignId}>
              <CardHeader className="flex-row items-center justify-between gap-4 pb-3">
                <div>
                  <CardTitle className="text-base">{p.campaignName}</CardTitle>
                  <p className="text-xs text-muted">
                    @{p.brandHandle} · {p.nodes} nodes contributing
                  </p>
                </div>
                {p.status === "claimable" ? (
                  <Badge variant="sting">Claimable</Badge>
                ) : (
                  <Badge variant="live">Active · accruing</Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-0">
                <div>
                  <span className="font-mono text-2xl font-semibold text-honey">
                    ${p.pendingUsdc.toFixed(2)}
                  </span>
                  <span className="ml-2 text-xs text-muted">
                    USDC ·{" "}
                    {p.closesInHours > 0
                      ? `closes in ${Math.floor(p.closesInHours / 24)}d ${p.closesInHours % 24}h`
                      : "campaign closed"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/c/${p.campaignId}`}>
                      View campaign
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                  {p.status === "claimable" && (
                    <Button
                      size="sm"
                      onClick={() => claim(p.campaignId, p.pendingUsdc)}
                      disabled={claiming === p.campaignId || !publicKey}
                    >
                      {claiming === p.campaignId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Coins className="h-3 w-3" />
                      )}
                      {claiming === p.campaignId ? "Claiming…" : "Claim"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {pending.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted">
                No pending payouts yet. Contribute to a campaign to start
                earning.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Claim history */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">History</h2>
        <Card className="mt-3">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-wax bg-bg2 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 text-right font-medium">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wax/60">
                {claimed.map((c) => (
                  <tr key={c.txSignature}>
                    <td className="px-5 py-3">{c.campaignName}</td>
                    <td className="px-5 py-3 font-mono text-honey">
                      ${c.amountUsdc.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {new Date(c.claimedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`https://explorer.solana.com/tx/${c.txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-honey hover:underline"
                      >
                        <Check className="h-3 w-3" />
                        {c.txSignature.slice(0, 8)}…
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
