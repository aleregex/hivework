"use client";

import { Bot, Coins, ExternalLink, GitFork, User, X, Zap } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TreeNode } from "@/lib/mocks/tree";

const LEVEL_LABEL: Record<number, string> = {
  0: "Root · campaign",
  1: "Level 1 · Hook",
  2: "Level 2 · Audio",
  3: "Level 3 · Visual",
  4: "Level 4 · Leaf",
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
    <aside className="flex h-full flex-col gap-5 rounded-xl border border-wax bg-comb p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant={node.level === 4 ? "honey" : "outline"}>
            {LEVEL_LABEL[node.level]}
          </Badge>
          <h3 className="mt-2 text-base font-semibold leading-tight">
            {node.title}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
            {node.author === "agent" ? (
              <Bot className="h-3 w-3 text-emerald-400" />
            ) : (
              <User className="h-3 w-3" />
            )}
            @{node.authorHandle}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail"
          className="rounded-md p-1 text-muted transition-colors hover:bg-wax hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm leading-relaxed text-foreground/90">
        {node.description}
      </p>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-wax bg-wax">
        <Metric
          icon={<GitFork className="h-3 w-3" />}
          label="Forks"
          value={node.forks}
        />
        <Metric
          icon={<Zap className="h-3 w-3 text-sting" />}
          label="Conversions"
          value={node.conversions}
          accent="sting"
        />
        <Metric
          icon={<Coins className="h-3 w-3 text-honey" />}
          label="Stake (SOL)"
          value={node.stakeSol}
        />
        <Metric
          icon={<Coins className="h-3 w-3 text-honey" />}
          label="Payout (USDC)"
          value={`$${node.payoutUsdc.toFixed(2)}`}
          accent="honey"
        />
      </div>

      {/* Leaf-specific: ref code + share */}
      {node.level === 4 && node.refCode && (
        <div className="rounded-lg border border-honey/30 bg-honey/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-honey">
            Referral link
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <code className="truncate font-mono text-xs">
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
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Open in a new tab to test the storefront. Each conversion fans out
            payouts up the path.
          </p>
        </div>
      )}

      {/* Demo affordance — lets the presenter trigger a fake conversion mid-pitch
           so the pulse animation is visible on this exact node. */}
      {onSimulateConversion && (
        <Button
          variant="sting"
          size="sm"
          onClick={() => onSimulateConversion(node.id)}
        >
          <Zap className="h-4 w-4" />
          Simulate +1 conversion (demo)
        </Button>
      )}

      <p className="mt-auto text-[10px] uppercase tracking-wider text-muted">
        Node id ·{" "}
        <span className="font-mono normal-case text-foreground/70">
          {node.id}
        </span>
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
    <div className="flex flex-col gap-1 bg-comb px-3 py-3">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
        {icon}
        {label}
      </span>
      <span className={`font-mono text-base font-semibold ${color}`}>
        {value}
      </span>
    </div>
  );
}
