"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Coins, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MOCK_CLAIMED_PAYOUTS,
  MOCK_PENDING_PAYOUTS,
  LIFETIME_TOTAL_USDC,
} from "@/lib/mocks/payouts";

export default function ClaimPage() {
  const { publicKey } = useWallet();
  const [claiming, setClaiming] = useState<string | null>(null);

  async function claim(campaignId: string, amount: number) {
    // TODO(group-c, task #6): replace with Anchor claimPayout tx.
    setClaiming(campaignId);
    await new Promise((r) => setTimeout(r, 1200));
    setClaiming(null);
    toast.success(`Claimed $${amount} USDC`, {
      description: "Funds are in your wallet.",
    });
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
              ${LIFETIME_TOTAL_USDC.toFixed(2)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-start gap-1 p-5">
            <span className="text-[10px] uppercase tracking-wider text-muted">
              Pending across campaigns
            </span>
            <span className="font-mono text-2xl font-semibold">
              $
              {MOCK_PENDING_PAYOUTS.reduce(
                (sum, p) => sum + p.pendingUsdc,
                0
              ).toFixed(2)}
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
          {MOCK_PENDING_PAYOUTS.map((p) => (
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
                      Open tree
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
          {MOCK_PENDING_PAYOUTS.length === 0 && (
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
                {MOCK_CLAIMED_PAYOUTS.map((c) => (
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
