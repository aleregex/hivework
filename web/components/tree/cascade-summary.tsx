"use client";

import { motion } from "framer-motion";
import { Bot, Coins, Crown, ExternalLink, User, Zap } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import type { TreeNode } from "@/lib/mocks/tree";

const PLATFORM_FEE = 0.05;

type Props = {
  /** Final state of the tree after the cascade. */
  nodes: TreeNode[];
  /** Pretend on-chain tx signature for the close + distribute. */
  closeTxSignature?: string;
  onReset: () => void;
};

export function CascadeSummary({ nodes, closeTxSignature, onReset }: Props) {
  // Compute distribution totals from the post-cascade node state.
  const totalDistributed = nodes
    .filter((n) => n.level >= 1)
    .reduce((sum, n) => sum + n.payoutUsdc, 0);
  const platformFee = totalDistributed * (PLATFORM_FEE / (1 - PLATFORM_FEE));
  const grossPool = totalDistributed + platformFee;

  // Top contributors aggregated by handle (one creator can own multiple nodes).
  const byCreator = new Map<
    string,
    { handle: string; author: TreeNode["author"]; total: number; nodes: number }
  >();
  for (const n of nodes) {
    if (n.level === 0) continue;
    const existing = byCreator.get(n.authorHandle) ?? {
      handle: n.authorHandle,
      author: n.author,
      total: 0,
      nodes: 0,
    };
    existing.total += n.payoutUsdc;
    existing.nodes += 1;
    byCreator.set(n.authorHandle, existing);
  }
  const topCreators = [...byCreator.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  // Top earning nodes regardless of creator.
  const topNodes = [...nodes]
    .filter((n) => n.level >= 1)
    .sort((a, b) => b.payoutUsdc - a.payoutUsdc)
    .slice(0, 3);

  const sig =
    closeTxSignature ??
    "5xK2mP3qN8rT9wY1aZbCdEfG7hJiKlMnOpQrStUvWxYz1aBcDeFgHiJkLmNoPqRsTuVw";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-xl border border-honey/40 bg-comb p-6 shadow-[0_30px_120px_-40px_rgba(245,197,24,0.4)]"
    >
      {/* Hero number */}
      <div className="flex flex-col items-center gap-2 border-b border-wax pb-6 text-center">
        <Badge variant="honey">Campaign closed · payouts distributed</Badge>
        <div className="font-mono text-5xl font-semibold text-honey">
          <AnimatedCounter value={totalDistributed} prefix="$" duration={1.6} />
        </div>
        <p className="text-xs uppercase tracking-wider text-muted">
          USDC paid out across {byCreator.size} contributors
        </p>
        <Link
          href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-honey hover:underline"
        >
          {sig.slice(0, 10)}…{sig.slice(-6)}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Breakdown */}
      <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-wax bg-wax sm:grid-cols-3">
        <Stat
          label="Pool gross"
          value={grossPool}
          icon={<Coins className="h-3 w-3 text-honey" />}
        />
        <Stat
          label="Platform fee (5%)"
          value={platformFee}
          icon={<Coins className="h-3 w-3 text-muted" />}
        />
        <Stat
          label="To contributors"
          value={totalDistributed}
          icon={<Crown className="h-3 w-3 text-honey" />}
          accent="honey"
        />
      </div>

      {/* Top creators + top nodes */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            Top creators
          </p>
          <ul className="mt-3 space-y-2">
            {topCreators.map((c, i) => (
              <motion.li
                key={c.handle}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center justify-between gap-3 rounded-md border border-wax bg-bg2 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">#{i + 1}</span>
                  {c.author === "agent" ? (
                    <Bot className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-foreground/70" />
                  )}
                  <div>
                    <p className="text-sm">@{c.handle}</p>
                    <p className="text-[11px] text-muted">
                      {c.nodes} node{c.nodes > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-sm font-semibold text-honey">
                  <AnimatedCounter
                    value={c.total}
                    prefix="$"
                    duration={1.2 + i * 0.2}
                  />
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            Top earning nodes
          </p>
          <ul className="mt-3 space-y-2">
            {topNodes.map((n, i) => (
              <motion.li
                key={n.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center justify-between gap-3 rounded-md border border-wax bg-bg2 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs text-muted">
                    L{n.level}
                  </span>
                  <div>
                    <p className="line-clamp-1 text-sm" title={n.title}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-muted">
                      <Zap className="mr-0.5 inline h-2.5 w-2.5 text-sting" />
                      {n.conversions} conv · @{n.authorHandle}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-sm font-semibold text-honey">
                  <AnimatedCounter
                    value={n.payoutUsdc}
                    prefix="$"
                    duration={1.2 + i * 0.2}
                  />
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* Reset for repeated demos. The real flow has no reset — the campaign is closed forever. */}
      <div className="mt-6 flex items-center justify-between border-t border-wax pt-4">
        <p className="text-[11px] text-muted">
          Stakes of nodes that never converted are redistributed to successful
          paths per the campaign config.
        </p>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Replay demo
        </Button>
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: "honey";
}) {
  const color = accent === "honey" ? "text-honey" : "text-foreground";
  return (
    <div className="flex flex-col gap-1 bg-comb px-4 py-3">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted">
        {icon}
        {label}
      </span>
      <span className={`font-mono text-lg font-semibold ${color}`}>
        <AnimatedCounter value={value} prefix="$" duration={1.4} />
      </span>
    </div>
  );
}
