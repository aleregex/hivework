"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLeafByRefCode } from "@/lib/mocks/leaves";

type PageProps = {
  params: Promise<{ refCode: string }>;
};

export default function BuyPage({ params }: PageProps) {
  const { refCode } = use(params);
  const ctx = getLeafByRefCode(refCode);
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ctx) {
    return (
      <main className="bg-honeycomb min-h-screen p-12">
        <div className="mx-auto max-w-md rounded-xl border border-wax bg-comb p-8 text-center">
          <h1 className="text-xl font-semibold">Link not found</h1>
          <p className="mt-2 text-sm text-muted">
            The referral code <code className="text-honey">{refCode}</code>{" "}
            doesn&apos;t exist or expired.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-6">
            <Link href="/">Back to Hivework</Link>
          </Button>
        </div>
      </main>
    );
  }

  const { leaf, campaign, path, pricingUsdc } = ctx;

  async function buy() {
    // TODO(group-c, task #6): POST /api/conversions to Group B's backend with the ref_code.
    // Backend verifies, oracle signs, smart contract registers the conversion on-chain.
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setPurchased(true);
    toast.success("Conversion registered on-chain", {
      description: `$${pricingUsdc} distributed across ${path.length} contributors.`,
    });
  }

  return (
    <main className="bg-honeycomb min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </Link>

        <div className="mt-3 flex items-center gap-2">
          <Badge variant="honey">Demo storefront</Badge>
          <span className="font-mono text-xs text-muted">ref: {refCode}</span>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{campaign.brand}</CardTitle>
                <p className="mt-1 text-sm text-muted">{campaign.product}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-3xl font-semibold text-honey">
                  ${pricingUsdc}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  USDC
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            {/* Recommended by */}
            <div className="rounded-lg border border-wax bg-bg2 p-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Sparkles className="h-3 w-3 text-honey" />
                Recommended by
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium">@{leaf.authorHandle}</p>
                <p className="mt-1 text-xs text-muted">{leaf.title}</p>
              </div>
            </div>

            {/* Path that led here */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">
                Decision path that led to this offer
              </p>
              <ol className="mt-3 space-y-2">
                {path.slice(1).map((node, i) => (
                  <li
                    key={node.id}
                    className="flex items-start gap-3 rounded-md border border-wax bg-comb p-3"
                  >
                    <span className="font-mono text-[10px] text-muted">
                      L{node.level}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm">{node.title}</p>
                      <p className="text-xs text-muted">
                        by @{node.authorHandle}{" "}
                        {node.author === "agent" && (
                          <Badge variant="honey" className="ml-1 text-[9px]">
                            agent
                          </Badge>
                        )}
                      </p>
                    </div>
                    {i < path.length - 2 && (
                      <span className="text-muted">↓</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {/* Buy button */}
            {purchased ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                <Check className="h-8 w-8 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-400">
                  Purchase confirmed · conversion on-chain
                </p>
                <p className="text-xs text-muted">
                  ${pricingUsdc} just got split across {path.length}{" "}
                  contributors. Watch the tree update in real time.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href={`/c/${campaign.id}`}>See the tree light up</Link>
                </Button>
              </div>
            ) : (
              <Button onClick={buy} disabled={loading} size="lg">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingBag className="h-4 w-4" />
                )}
                {loading ? "Processing…" : `Buy now · $${pricingUsdc} USDC`}
              </Button>
            )}

            <p className="text-center text-[11px] text-muted">
              This is a demo storefront. In production the redirect would land
              on the real brand checkout (Solana Pay, Stripe, etc) — Hivework
              only needs the conversion event signed by the oracle.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
