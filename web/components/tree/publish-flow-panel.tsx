"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type TreeNode } from "@/lib/mocks/tree";

export type PublishStep = "hook" | "audio" | "visual";

export type PublishState = {
  hookId: string | null;
  audioId: string | null;
  visualId: string | null;
  refCode: string | null; // generated on publish
};

const STEP_LABEL: Record<PublishStep, string> = {
  hook: "L1 · hook",
  audio: "L2 · audio",
  visual: "L3 · visual",
};

const STEP_HINT: Record<PublishStep, string> = {
  hook: "Pick a hook to anchor your content's first 3 seconds.",
  audio: "Pick an audio that pairs with that hook.",
  visual: "Pick the visual style for the key moment.",
};

type Props = {
  state: PublishState;
  /** The next step waiting for a click on the tree, or null if path complete. */
  activeStep: PublishStep | null;
  onClearStep: (step: PublishStep) => void;
  onPublish: () => void;
  onReset: () => void;
  /** Current tree nodes — used to resolve hook/audio/visual titles. */
  nodes: TreeNode[];
};

/**
 * Sidebar panel that walks an influencer through "pick a path → publish leaf".
 * The actual selection happens by clicking nodes on the tree (the panel just
 * mirrors progress + finalizes). When the path is complete, the panel becomes
 * a publish CTA, then a QR/link card with stats.
 */
export function PublishFlowPanel({
  state,
  activeStep,
  onClearStep,
  onPublish,
  onReset,
  nodes,
}: Props) {
  const findById = (id: string | null) =>
    id ? nodes.find((n) => n.id === id) : undefined;
  const hook = findById(state.hookId);
  const audio = findById(state.audioId);
  const visual = findById(state.visualId);
  const pathComplete = !!hook && !!audio && !!visual;

  // After publish: show the QR + link state.
  if (state.refCode) {
    return (
      <PublishedCard
        refCode={state.refCode}
        path={[hook!, audio!, visual!]}
        onReset={onReset}
      />
    );
  }

  return (
    <aside className="flex h-full flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-honey">
          publish post
        </p>
        <h3 className="mt-1.5 text-base font-semibold leading-tight">
          Compose your path on the tree
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-soft">
          Click any pulsing node to lock in that step. We&apos;ll generate a
          unique ref-link + QR for the path you compose.
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        <Step
          step="hook"
          active={activeStep === "hook"}
          node={hook}
          onClear={() => onClearStep("hook")}
        />
        <Connector />
        <Step
          step="audio"
          active={activeStep === "audio"}
          node={audio}
          locked={!hook}
          onClear={() => onClearStep("audio")}
        />
        <Connector />
        <Step
          step="visual"
          active={activeStep === "visual"}
          node={visual}
          locked={!audio}
          onClear={() => onClearStep("visual")}
        />
      </ol>

      {pathComplete ? (
        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
          <div className="rounded-md border border-honey/30 bg-honey/5 p-3 font-mono text-[11px] leading-relaxed text-honey">
            Phantom will sign 1 tx: stake 0.1 SOL + publish post. You earn the
            base path payout + 30% post bonus on every conversion.
          </div>
          <Button variant="honey" onClick={onPublish}>
            <Sparkles className="h-4 w-4" />
            Stake 0.1 SOL & publish
          </Button>
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1.5 font-mono text-[11px] text-muted transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            start over
          </button>
        </div>
      ) : (
        <div className="mt-auto rounded-md border border-line bg-ink-2/60 p-3 font-mono text-[11px] leading-relaxed text-muted">
          <span className="text-honey">›</span>{" "}
          {activeStep
            ? STEP_HINT[activeStep]
            : "All steps locked. Continue to publish."}
        </div>
      )}
    </aside>
  );
}

function Step({
  step,
  active,
  node,
  locked,
  onClear,
}: {
  step: PublishStep;
  active: boolean;
  node?: TreeNode;
  locked?: boolean;
  onClear: () => void;
}) {
  const filled = !!node;
  const stateClass = locked
    ? "border-line/60 bg-ink-2/40 opacity-50"
    : filled
      ? "border-honey/40 bg-honey/[0.04]"
      : active
        ? "border-honey/60 bg-honey/[0.06]"
        : "border-line bg-ink-2/40";
  return (
    <li
      className={`relative flex items-start gap-3 rounded-md border p-3 transition-colors ${stateClass}`}
    >
      <StepBadge
        step={step}
        state={filled ? "done" : active ? "active" : "idle"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {STEP_LABEL[step]}
          </span>
          {filled && (
            <button
              onClick={onClear}
              className="rounded p-0.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label={`Clear ${step}`}
              title="Clear this step"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {node ? (
          <>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
              {node.title}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              @{node.authorHandle} <span className="text-faint">·</span>{" "}
              <span className="text-sting tabular">
                {node.conversions} conv
              </span>
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted">
            {locked
              ? "Locked — finish previous step"
              : active
                ? "Pick on the tree…"
                : "Pending"}
          </p>
        )}
      </div>
    </li>
  );
}

function StepBadge({
  step,
  state,
}: {
  step: PublishStep;
  state: "idle" | "active" | "done";
}) {
  const n = step === "hook" ? "1" : step === "audio" ? "2" : "3";
  return (
    <span
      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold ${
        state === "done"
          ? "bg-honey text-ink"
          : state === "active"
            ? "border border-honey/60 bg-honey/10 text-honey"
            : "border border-line bg-surface-2 text-muted"
      }`}
    >
      {state === "done" ? <Check className="h-3.5 w-3.5" /> : n}
    </span>
  );
}

function Connector() {
  return <div className="ml-3 h-3 w-px bg-line-strong" aria-hidden />;
}

/* ------------------------------------------------------------------ *
 * Published state — QR + link + share artifacts.
 * ------------------------------------------------------------------ */

function PublishedCard({
  refCode,
  path,
  onReset,
}: {
  refCode: string;
  path: TreeNode[];
  onReset: () => void;
}) {
  const url = `https://hivework.link/${refCode}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — long-press the link to copy manually");
    }
  };

  const downloadQr = () => {
    // Pull the rendered SVG out of the DOM and offer it as a file.
    const svg = document.getElementById("publish-qr") as SVGSVGElement | null;
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `hivework-${refCode}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex h-full flex-col gap-4 rounded-lg border border-honey/40 bg-surface p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-honey">
            post published · live on devnet
          </p>
          <h3 className="mt-1.5 text-base font-semibold leading-tight">
            Your referral is live
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-live/30 bg-live/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-live">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
          </span>
          live
        </span>
      </header>

      {/* QR */}
      <div className="flex items-start gap-4">
        <div className="rounded-md border border-line bg-foreground p-2">
          <QRCodeSVG
            id="publish-qr"
            value={url}
            size={108}
            level="M"
            bgColor="#ECF0F3"
            fgColor="#0A0B0D"
            marginSize={0}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            onClick={copy}
            className="group inline-flex w-full items-center justify-between gap-2 rounded-md border border-line bg-ink-2 px-2.5 py-2 text-left font-mono text-[11px] text-foreground transition-colors hover:border-honey/40"
            title="Click to copy"
          >
            <span className="truncate">{url}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-live" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-honey" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={downloadQr}
            >
              <Download className="h-3.5 w-3.5" />
              QR
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href={`/buy/${refCode}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Test
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Path summary */}
      <div className="rounded-md border border-line bg-ink-2/40 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          path locked
        </p>
        <ol className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed text-fg-soft">
          {path.map((n, i) => (
            <li key={n.id} className="flex items-center gap-2">
              <span className="text-faint">L{n.level}</span>
              <ArrowRight className="h-3 w-3 text-faint" />
              <span className="truncate">{n.title}</span>
              {i < path.length - 1 && null}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-md border border-honey/30 bg-honey/5 p-3 font-mono text-[11px] leading-relaxed text-honey">
        Every conversion through this link pays the full path proportionally.
        You get a +30% post bonus on top.
      </div>

      <Button variant="ghost" size="sm" onClick={onReset} className="mt-auto">
        <RotateCcw className="h-3.5 w-3.5" />
        Publish another post
      </Button>
    </motion.aside>
  );
}
