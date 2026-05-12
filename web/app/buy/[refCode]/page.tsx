"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Info,
  Loader2,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLeafByRef, postDemoConvert } from "@/lib/api/hooks";
import { adaptLeafBuyContext } from "@/lib/api/adapters";
import { ApiError } from "@/lib/api/client";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { transferUsdc } from "@/lib/solana/usdc-transfer";

type Phase = "idle" | "paying" | "attesting" | "done" | "error";

type BuyResult = {
  paymentSig: string;
  oracleStatus: "pending" | "pushed_to_chain" | "rejected";
  oracleSig: string | null;
};

// Map the api/'s error codes (api/src/routes/demo.ts) to human copy.
function describeApiError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Couldn't register conversion. Try again.";
  }
  switch (err.code) {
    case "ref_code_not_found":
      return "This referral link doesn't exist or has expired.";
    case "leaf_not_finalized":
      return "Leaf is still confirming on-chain. Wait a few seconds and retry.";
    case "campaign_not_finalized":
      return "Campaign setup is incomplete on-chain. Notify the brand.";
    case "path_not_onchain":
      return "One of the parent nodes hasn't been finalized on-chain yet.";
    default:
      return err.message || "Couldn't register conversion. Try again.";
  }
}

function shortSig(sig: string): string {
  return `${sig.slice(0, 8)}…${sig.slice(-6)}`;
}

type PageProps = {
  params: Promise<{ refCode: string }>;
};

export default function BuyPage({ params }: PageProps) {
  const { refCode } = use(params);
  const { data, isLoading } = useLeafByRef(refCode);
  const ctx = data ? adaptLeafBuyContext(data) : null;
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<BuyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (isLoading) {
    return (
      <main className="bg-honeycomb min-h-screen p-12">
        <div className="mx-auto max-w-md rounded-xl border border-wax bg-comb p-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" />
        </div>
      </main>
    );
  }

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
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    const usdcMintStr = process.env.NEXT_PUBLIC_USDC_MINT;
    if (!usdcMintStr) {
      toast.error("Missing NEXT_PUBLIC_USDC_MINT in .env.local");
      return;
    }
    if (!campaign.creatorWallet) {
      toast.error("Campaign creator wallet is unknown");
      return;
    }

    setErrorMsg(null);

    // Phase 1: pay the brand. For now we send USDC directly to the campaign
    // creator's wallet — proper flow (Solana Pay, brand checkout) lives later.
    setPhase("paying");
    let paymentSig: string;
    try {
      paymentSig = await transferUsdc({
        connection,
        payer: publicKey,
        recipient: new PublicKey(campaign.creatorWallet),
        usdcMint: new PublicKey(usdcMintStr),
        amountUsdc: pricingUsdc,
        sendTransaction,
      });
      toast.success("Payment sent", { description: `tx ${shortSig(paymentSig)}` });
    } catch (err) {
      console.error("usdc payment failed", err);
      const msg = err instanceof Error ? err.message : "Payment failed.";
      setErrorMsg(msg);
      setPhase("error");
      toast.error("Payment failed", { description: msg });
      return;
    }

    // Phase 2: attest the conversion via the oracle. The api forwards to the
    // oracle webhook; status reflects what came back.
    setPhase("attesting");
    try {
      const res = await postDemoConvert({
        refCode,
        valueUsdc: pricingUsdc,
        buyerWallet: publicKey.toBase58(),
        source: "demo_buy_page",
      });
      setResult({
        paymentSig,
        oracleStatus: res.status,
        oracleSig: res.txSignature,
      });
      setPhase("done");

      if (res.status === "pushed_to_chain") {
        toast.success("Conversion attested on-chain", {
          description: res.txSignature
            ? `tx ${shortSig(res.txSignature)}`
            : `${path.length} contributors recorded`,
        });
      } else if (res.status === "pending") {
        toast.info("Conversion accepted — waiting for oracle", {
          description: "The poller will push it on-chain shortly.",
        });
      } else {
        toast.error("Conversion rejected by the oracle", {
          description: "Anti-fraud or backend verification failed.",
        });
      }
    } catch (err) {
      const msg = describeApiError(err);
      // Payment already went through — surface that so the user knows.
      setResult({ paymentSig, oracleStatus: "rejected", oracleSig: null });
      setPhase("done");
      setErrorMsg(msg);
      toast.error(msg, {
        description: `Payment tx ${shortSig(paymentSig)} succeeded but the oracle attestation failed.`,
      });
    }
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

            {/* Buy button + result */}
            {phase === "done" && result ? (
              <div
                className={`flex flex-col items-center gap-3 rounded-lg border p-6 text-center ${
                  result.oracleStatus === "pushed_to_chain"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : result.oracleStatus === "pending"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-red-500/30 bg-red-500/10"
                }`}
              >
                {result.oracleStatus === "pushed_to_chain" ? (
                  <>
                    <Check className="h-8 w-8 text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-400">
                      Payment sent · conversion attested on-chain
                    </p>
                    <p className="text-xs text-muted">
                      ${pricingUsdc} USDC went to @{campaign.brandHandle}. The
                      tree will reflect the conversion in real time.
                    </p>
                  </>
                ) : result.oracleStatus === "pending" ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                    <p className="text-sm font-medium text-amber-400">
                      Payment sent · waiting for oracle attestation
                    </p>
                    <p className="text-xs text-muted">
                      Your USDC reached the brand. The oracle poller will push
                      the conversion on-chain shortly.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-red-400">
                      Payment sent · oracle attestation failed
                    </p>
                    <p className="text-xs text-muted">
                      {errorMsg ??
                        "The oracle declined this conversion. The payment already went through — see the tx below."}
                    </p>
                  </>
                )}

                <div className="flex w-full flex-col gap-1 rounded-md border border-wax bg-bg2 p-3 text-left">
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted">
                    <span>Payment tx</span>
                    <Link
                      href={`https://explorer.solana.com/tx/${result.paymentSig}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-honey hover:underline"
                    >
                      {shortSig(result.paymentSig)}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  {result.oracleSig && (
                    <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted">
                      <span>Oracle tx</span>
                      <Link
                        href={`https://explorer.solana.com/tx/${result.oracleSig}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-honey hover:underline"
                      >
                        {shortSig(result.oracleSig)}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>

                <Button asChild variant="outline" size="sm">
                  <Link href={`/c/${campaign.id}`}>See the tree light up</Link>
                </Button>
              </div>
            ) : (
              <>
                {/* The buyer is about to sign a real Solana tx. Make the
                    payee + amount explicit so there's no surprise in the
                    wallet popup. */}
                <div className="flex items-start gap-2 rounded-md border border-wax bg-bg2 p-3 text-[11px] text-muted">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-honey" />
                  <p>
                    You&apos;ll sign two things: a <strong className="text-foreground">${pricingUsdc} USDC transfer</strong>{" "}
                    to{" "}
                    <span className="font-mono text-foreground">
                      {campaign.creatorWallet.slice(0, 4)}…
                      {campaign.creatorWallet.slice(-4)}
                    </span>{" "}
                    (the brand), then the oracle attests the conversion
                    on-chain. Payouts to contributors cascade when the campaign
                    closes.
                  </p>
                </div>

                {!connected || !publicKey ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-muted">
                      Connect a wallet with devnet USDC to buy.
                    </p>
                    <WalletConnectButton />
                  </div>
                ) : (
                  <Button
                    onClick={buy}
                    disabled={phase === "paying" || phase === "attesting"}
                    size="lg"
                  >
                    {phase === "paying" || phase === "attesting" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShoppingBag className="h-4 w-4" />
                    )}
                    {phase === "paying"
                      ? "Sending USDC…"
                      : phase === "attesting"
                      ? "Attesting conversion…"
                      : `Pay $${pricingUsdc} USDC`}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
