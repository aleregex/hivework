"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Coins,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Whether the cascade has already played — disable buttons that would conflict. */
  disabled: boolean;
  onSpawnAgentNode: () => void;
  onPublishLeaf: () => void;
  onFireConversion: () => void;
  onFireConversionBurst: (count: number) => void;
  onClose: () => void;
  onReset: () => void;
};

/**
 * Floating panel that the presenter clicks during the pitch to drive the demo
 * forward in order. Lives bottom-right of /c/[id]. Always visible (this is a
 * hackathon demo, not production), collapsible to free screen space when not
 * mid-pitch.
 *
 * The buttons follow the script order:
 *   0:50 — AI agent spawns nodes
 *   1:15 — a teammate publishes a leaf
 *   1:30 — conversions start rolling in
 *   2:00 — campaign closes, cascade plays
 */
export function DemoControlPanel({
  disabled,
  onSpawnAgentNode,
  onPublishLeaf,
  onFireConversion,
  onFireConversionBurst,
  onClose,
  onReset,
}: Props) {
  const [open, setOpen] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="fixed bottom-4 right-4 z-40 w-72 overflow-hidden rounded-xl border border-honey/40 bg-comb/95 shadow-[0_30px_80px_-30px_rgba(245,197,24,0.35)] backdrop-blur-md"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 border-b border-wax px-4 py-2.5 text-left transition-colors hover:bg-honey/5"
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-honey px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-hive">
            Demo
          </span>
          <span className="text-sm font-semibold">Pitch controls</span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              <Step n={1} label="Tree growth" />
              <Action
                onClick={onSpawnAgentNode}
                disabled={disabled}
                icon={<Bot className="h-3.5 w-3.5 text-emerald-400" />}
                label="AI agent spawns a node"
                hint="Adds 1 agent-authored node with a fade-in"
              />
              <Action
                onClick={onPublishLeaf}
                disabled={disabled}
                icon={<Sparkles className="h-3.5 w-3.5 text-honey" />}
                label="Publish post as @teammate"
                hint="Composes a path + emits a ref-link"
              />

              <Step n={2} label="Conversions roll in" className="mt-2" />
              <Action
                onClick={onFireConversion}
                disabled={disabled}
                icon={<Zap className="h-3.5 w-3.5 text-sting" />}
                label="Fire +1 conversion"
                hint="Picks a hot post, lights up the path"
              />
              <Action
                onClick={() => onFireConversionBurst(5)}
                disabled={disabled}
                icon={<Zap className="h-3.5 w-3.5 text-sting" />}
                label="Fire +5 conversions burst"
                hint="Spaced ~400ms apart for visual impact"
                accent="sting"
              />

              <Step n={3} label="Close & distribute" className="mt-2" />
              <Action
                onClick={onClose}
                disabled={disabled}
                icon={<Coins className="h-3.5 w-3.5 text-honey" />}
                label="Close & distribute"
                hint="Triggers the USDC cascade"
                accent="honey"
              />

              <div className="my-2 h-px bg-wax" />
              <Action
                onClick={onReset}
                disabled={false}
                icon={<RotateCcw className="h-3.5 w-3.5 text-muted" />}
                label="Reset to baseline"
                hint="Restore the seeded tree"
                ghost
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Step({
  n,
  label,
  className,
}: {
  n: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-1 pb-1 text-[10px] uppercase tracking-wider text-muted",
        className
      )}
    >
      <span className="font-mono">{n}.</span>
      <span>{label}</span>
    </div>
  );
}

function Action({
  onClick,
  disabled,
  icon,
  label,
  hint,
  accent,
  ghost,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  hint: string;
  accent?: "honey" | "sting";
  ghost?: boolean;
}) {
  const accentRing =
    accent === "honey"
      ? "hover:border-honey/60 hover:bg-honey/5"
      : accent === "sting"
        ? "hover:border-sting/60 hover:bg-sting/5"
        : "hover:border-wax/80 hover:bg-bg2";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex items-start gap-2 rounded-md border border-wax/60 bg-comb px-2.5 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40",
        ghost ? "border-transparent bg-transparent hover:bg-comb" : accentRing
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="flex-1 leading-tight">
        <span className="block text-xs font-medium text-foreground">
          {label}
        </span>
        <span className="block text-[10px] text-muted">{hint}</span>
      </span>
    </button>
  );
}
