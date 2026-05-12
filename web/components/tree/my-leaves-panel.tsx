"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  ImageIcon,
  Wallet,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useCampaign, usePortfolio } from "@/lib/api/hooks";
import { adaptMyLeavesForCampaign } from "@/lib/api/adapters";
import { summarizeMyLeaves, type MyLeafEnriched } from "@/lib/mocks/my-leaves";
import { shortlinkDisplay, shortlinkUrl } from "@/lib/shortlink";

type Props = {
  campaignId: string;
};

/**
 * Lists every leaf the connected wallet has published in this campaign,
 * with QR + link + per-leaf stats.
 *
 * Joins two reads: the wallet's portfolio (which leaves it owns) and the
 * campaign tree (to resolve the path titles for each leaf). Both queries
 * use react-query so cross-tab navigation stays cheap.
 */
export function MyLeavesPanel({ campaignId }: Props) {
  const { publicKey } = useWallet();
  const address = publicKey?.toBase58();
  const { data: portfolio } = usePortfolio(address);
  const { data: campaignDetail } = useCampaign(campaignId);
  const leaves = useMemo<MyLeafEnriched[]>(() => {
    if (!portfolio || !campaignDetail) return [];
    return adaptMyLeavesForCampaign(portfolio, campaignDetail, campaignId);
  }, [portfolio, campaignDetail, campaignId]);

  if (!publicKey) {
    return (
      <aside className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-line bg-surface/50 p-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface-2">
          <Wallet className="h-4 w-4 text-muted" />
        </span>
        <div>
          <p className="text-sm font-medium">Connect your wallet</p>
          <p className="mt-1 text-xs text-muted">
            We&apos;ll show every post you&apos;ve published in this campaign,
            with live click + conversion stats.
          </p>
        </div>
        <WalletConnectButton />
      </aside>
    );
  }

  if (leaves.length === 0) {
    return (
      <aside className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-surface/50 p-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface-2">
          <ImageIcon className="h-4 w-4 text-muted" />
        </span>
        <div>
          <p className="text-sm font-medium">No posts yet in this campaign</p>
          <p className="mt-1 text-xs text-muted">
            Use the <span className="text-honey">publish</span> tab to compose a
            path and generate your first ref-link.
          </p>
        </div>
      </aside>
    );
  }

  const totals = summarizeMyLeaves(leaves);

  return (
    <aside className="flex h-full flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-honey">
          your posts · this campaign
        </p>
        <h3 className="mt-1.5 text-base font-semibold leading-tight">
          {leaves.length} active{" "}
          {leaves.length === 1 ? "ref-link" : "ref-links"}
        </h3>
      </header>

      {/* Aggregate strip */}
      <div className="grid grid-cols-3 divide-x divide-line/60 rounded-md border border-line bg-ink-2/40">
        <Stat label="clicks" value={totals.clicks} />
        <Stat label="conv" value={totals.conversions} accent="sting" />
        <Stat
          label="usdc"
          value={`$${totals.earningsUsdc.toFixed(2)}`}
          accent="honey"
        />
      </div>

      {/* List */}
      <ul className="flex flex-col gap-3">
        {leaves.map((leaf) => (
          <LeafRow key={leaf.refCode} leaf={leaf} />
        ))}
      </ul>
    </aside>
  );
}

function LeafRow({ leaf }: { leaf: MyLeafEnriched }) {
  const url = shortlinkUrl(leaf.refCode);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-ink-2/40 p-3">
      <div className="flex items-start gap-3">
        <div className="rounded border border-line bg-foreground p-1.5">
          <QRCodeSVG
            value={url}
            size={56}
            level="M"
            bgColor="#ECF0F3"
            fgColor="#0A0B0D"
            marginSize={0}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="group inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded border border-line bg-ink px-2 py-1.5 text-left font-mono text-[11px] transition-colors hover:border-honey/40"
              title="Click to copy"
            >
              <span className="truncate">{shortlinkDisplay(leaf.refCode)}</span>
              {copied ? (
                <Check className="h-3 w-3 text-live" />
              ) : (
                <Copy className="h-3 w-3 text-muted group-hover:text-honey" />
              )}
            </button>
            <Button asChild variant="outline" size="sm" className="h-7 px-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                title="Open referral link"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>

          {/* Per-leaf metrics */}
          <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
            <Metric label="clicks" value={leaf.clicks} />
            <Metric label="conv" value={leaf.conversions} accent="sting" />
            <Metric
              label="usdc"
              value={`$${leaf.earningsUsdc.toFixed(2)}`}
              accent="honey"
            />
          </div>
        </div>
      </div>

      {/* Path summary */}
      <div className="rounded border border-line/60 bg-ink/40 px-2.5 py-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
          path
        </p>
        <ol className="mt-1 space-y-0.5 font-mono text-[10px] leading-snug text-fg-soft">
          <PathLine label="L1" title={leaf.hook.title} />
          <PathLine label="L2" title={leaf.audio.title} />
          <PathLine label="L3" title={leaf.visual.title} />
        </ol>
      </div>

      {leaf.contentUrl ? (
        <Link
          href={leaf.contentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted transition-colors hover:text-honey"
        >
          <ExternalLink className="h-3 w-3" />
          published content
        </Link>
      ) : (
        <p className="font-mono text-[10px] text-faint">
          <span className="text-honey">›</span> add your published URL once the
          content goes live
        </p>
      )}
    </li>
  );
}

function PathLine({ label, title }: { label: string; title: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="text-faint">{label}</span>
      <ArrowRight className="h-2.5 w-2.5 text-faint" />
      <span className="truncate">{title}</span>
    </li>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "honey" | "sting";
}) {
  const color =
    accent === "honey"
      ? "text-honey"
      : accent === "sting"
        ? "text-sting"
        : "text-foreground";
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2.5">
      <span className={`font-mono text-base font-semibold tabular ${color}`}>
        {value}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "honey" | "sting";
}) {
  const color =
    accent === "honey"
      ? "text-honey"
      : accent === "sting"
        ? "text-sting"
        : "text-foreground";
  return (
    <div className="flex flex-col items-start gap-0.5 rounded border border-line/60 bg-ink/40 px-2 py-1.5">
      <span className="text-[8px] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <span className={`font-semibold tabular ${color}`}>{value}</span>
    </div>
  );
}
