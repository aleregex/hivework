"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, ExternalLink, Sparkles } from "lucide-react";
import { type TreeNode } from "@/lib/mocks/tree";

/* ------------------------------------------------------------------ *
 * Real-time view of the AI agent's activity inside a campaign tree.
 * Lists every node + leaf that an agent wallet authored (identified
 * by `author: "agent"` in the api-adapted tree), newest-first, and
 * surfaces the highest-converting path so the user can publish along
 * the same lineage with one click.
 * ------------------------------------------------------------------ */

export type PathSuggestion = {
  hookId: string;
  audioId: string;
  visualId: string;
  reason: string;
};

type Props = {
  onAcceptPath: (path: PathSuggestion) => void;
  /** Current tree nodes — the panel filters for `author === "agent"`. */
  nodes: TreeNode[];
};

export function AgentChatPanel({ onAcceptPath, nodes }: Props) {
  const agentNodes = useMemo(
    () =>
      nodes
        .filter((n) => n.author === "agent" && n.level >= 1 && n.level <= 4)
        // Stable ordering: leaves first (they're terminal output), then deeper
        // levels. Within a level we keep insertion order.
        .sort((a, b) => b.level - a.level),
    [nodes],
  );

  // Best path = the (L1, L2, L3) triple with the highest descendant conversion
  // count when at least one agent node is in the chain. Falls back to "no
  // suggestion yet" when the tree is too sparse.
  const suggestion = useMemo<{ path: PathSuggestion; conversions: number } | null>(() => {
    const l1s = nodes.filter((n) => n.level === 1);
    const l2s = nodes.filter((n) => n.level === 2);
    const l3s = nodes.filter((n) => n.level === 3);
    if (!l1s.length || !l2s.length || !l3s.length) return null;

    let best: { path: PathSuggestion; conversions: number } | null = null;
    for (const v of l3s) {
      const audio = l2s.find((n) => n.id === v.parentId);
      if (!audio) continue;
      const hook = l1s.find((n) => n.id === audio.parentId);
      if (!hook) continue;
      const conversions = v.conversions + audio.conversions + hook.conversions;
      const hasAgent =
        hook.author === "agent" ||
        audio.author === "agent" ||
        v.author === "agent";
      if (!hasAgent) continue;
      if (!best || conversions > best.conversions) {
        best = {
          path: {
            hookId: hook.id,
            audioId: audio.id,
            visualId: v.id,
            reason: conversions
              ? `Highest-converting path involving an agent node: ${conversions} conversions across L1→L3.`
              : "Agent-authored path — not yet converted, but ready to publish under.",
          },
          conversions,
        };
      }
    }
    return best;
  }, [nodes]);

  return (
    <aside className="flex h-full min-h-[440px] flex-col rounded-lg border border-line bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-md border border-live/30 bg-live/10">
            <Bot className="h-3.5 w-3.5 text-live" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
            </span>
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Agent activity</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              authored on-chain via MCP
            </p>
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          {agentNodes.length} item{agentNodes.length === 1 ? "" : "s"}
        </span>
      </header>

      {/* Suggestion */}
      {suggestion && (
        <SuggestionCard
          suggestion={suggestion}
          nodes={nodes}
          onAcceptPath={onAcceptPath}
        />
      )}

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {agentNodes.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2.5">
            {agentNodes.map((n) => (
              <ActivityRow key={n.id} node={n} />
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-line px-4 py-2.5 text-[11px] leading-snug text-muted">
        Agent wallets stake SOL on every node and earn USDC from the same
        proportional payout formula as human creators.
      </footer>
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[12px] text-muted">
      <Bot className="h-5 w-5 text-faint" />
      <p>
        No agent activity in this campaign yet.
        <br />
        Connect an MCP agent or wait for one to drop a hook.
      </p>
      <Link
        href="/agent"
        className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-honey hover:underline"
      >
        How agents join <ExternalLink className="h-2.5 w-2.5" />
      </Link>
    </div>
  );
}

function ActivityRow({ node }: { node: TreeNode }) {
  const label =
    node.level === 1
      ? "L1 · Hook"
      : node.level === 2
        ? "L2 · Audio"
        : node.level === 3
          ? "L3 · Visual"
          : "Leaf · Post";
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded-md border border-line bg-ink-2 p-2.5"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-live/30 bg-live/10 text-live">
        <Bot className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            {label}
          </span>
          <span className="font-mono text-[10px] text-muted">
            @{node.authorHandle}
          </span>
        </div>
        <p className="mt-1 truncate text-sm leading-snug text-foreground" title={node.title}>
          {node.title}
        </p>
        <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-muted">
          <span className="tabular">{node.forks} fork{node.forks === 1 ? "" : "s"}</span>
          <span className="tabular text-sting">{node.conversions} conv</span>
          <span className="tabular">{node.stakeSol.toFixed(2)} SOL</span>
        </div>
      </div>
    </motion.li>
  );
}

function SuggestionCard({
  suggestion,
  nodes,
  onAcceptPath,
}: {
  suggestion: { path: PathSuggestion; conversions: number };
  nodes: TreeNode[];
  onAcceptPath: (path: PathSuggestion) => void;
}) {
  const hook = nodes.find((n) => n.id === suggestion.path.hookId);
  const audio = nodes.find((n) => n.id === suggestion.path.audioId);
  const visual = nodes.find((n) => n.id === suggestion.path.visualId);
  if (!hook || !audio || !visual) return null;

  return (
    <div className="border-b border-line bg-honey/[0.04] px-4 py-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-honey">
        <Sparkles className="h-3 w-3" />
        suggested path
      </p>
      <div className="mt-2 space-y-1 rounded-md border border-line bg-ink-2 p-2.5 font-mono text-[11px] leading-relaxed text-fg-soft">
        <PathRow label="L1" node={hook} />
        <PathRow label="L2" node={audio} />
        <PathRow label="L3" node={visual} />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">
        <span className="text-honey">why · </span>
        {suggestion.path.reason}
      </p>
      <button
        onClick={() => onAcceptPath(suggestion.path)}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-honey px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink transition-colors hover:bg-honey-soft"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Use this path
      </button>
    </div>
  );
}

function PathRow({ label, node }: { label: string; node: TreeNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-faint">{label}</span>
      <span className="truncate text-foreground">{node.title}</span>
      <span className="ml-auto text-sting tabular">{node.conversions}c</span>
    </div>
  );
}
