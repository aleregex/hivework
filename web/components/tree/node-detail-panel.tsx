"use client";

import { Bot, Coins, ExternalLink, GitFork, User, X, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { TreeNode } from "@/lib/mocks/tree";

const LEVEL_LABEL: Record<number, string> = {
  0: "campaign",
  1: "L1 · hook",
  2: "L2 · audio",
  3: "L3 · visual",
  4: "L4 · leaf",
};

type Props = {
  node: TreeNode;
  onClose: () => void;
  onSimulateConversion?: (nodeId: string) => void;
};

export function NodeDetailPanel({
  node,
  onClose,
  onSimulateConversion,
}: Props) {
  return (
    <aside className="flex h-full flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-honey">
            {LEVEL_LABEL[node.level]}
          </p>
          <h3 className="mt-1.5 line-clamp-2 text-base font-semibold leading-tight">
            {node.title}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
            {node.author === "agent" ? (
              <Bot className="h-3 w-3 text-live" />
            ) : (
              <User className="h-3 w-3" />
            )}
            @{node.authorHandle}
            {node.author === "agent" && (
              <span className="rounded-full border border-live/30 bg-live/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-live">
                ai
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail"
          className="rounded p-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <p className="text-sm leading-relaxed text-fg-soft">{node.description}</p>

      {/* Metrics — 2x2 grid like a console panel */}
      <div className="grid grid-cols-2 divide-x divide-y divide-line/60 overflow-hidden rounded-md border border-line/60 bg-ink-2/40">
        <Metric
          icon={<GitFork className="h-3 w-3" />}
          label="forks"
          value={node.forks}
        />
        <Metric
          icon={<Zap className="h-3 w-3 text-sting" />}
          label="conversions"
          value={node.conversions}
          accent="sting"
        />
        <Metric
          icon={<Coins className="h-3 w-3 text-honey" />}
          label="stake (sol)"
          value={node.stakeSol}
        />
        <Metric
          icon={<Coins className="h-3 w-3 text-honey" />}
          label="payout (usdc)"
          value={`$${node.payoutUsdc.toFixed(2)}`}
          accent="honey"
        />
      </div>

      {/* Leaf-only: ref-link */}
      {node.level === 4 && node.refCode && (
        <div className="rounded-md border border-honey/30 bg-honey/5 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-honey">
            referral link
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <code className="truncate font-mono text-[11px] text-foreground">
              hivework.link/{node.refCode}
            </code>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-honey"
            >
              <Link
                href={`/buy/${node.refCode}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open storefront"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Open in a new tab to test the storefront. Each conversion fans out
            payouts up the path.
          </p>
        </div>
      )}

      {/* Demo affordance — fire a conversion through this exact node */}
      {onSimulateConversion && (
        <Button
          variant="sting"
          size="sm"
          onClick={() => onSimulateConversion(node.id)}
        >
          <Zap className="h-4 w-4" />
          Simulate +1 conversion
        </Button>
      )}

      <p className="mt-auto font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        node id ·{" "}
        <span className="normal-case text-fg-soft">{node.id}</span>
      </p>
    </aside>
  );
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: "sting" | "honey";
}) {
  const color =
    accent === "sting"
      ? "text-sting"
      : accent === "honey"
        ? "text-honey"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-1 bg-surface px-3 py-2.5">
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {icon}
        {label}
      </span>
      <span className={`font-mono text-base font-semibold tabular ${color}`}>
        {value}
      </span>
    </div>
  );
}
