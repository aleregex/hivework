"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { GraphData, TreeNode } from "@/lib/mocks/tree";

// react-force-graph-2d touches window during init, so we have to load it client-side only.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-muted">
      Loading force graph…
    </div>
  ),
});

// Hivework palette resolved to hex so the canvas can paint them directly
// (CSS variables don't work inside the canvas context).
const COLOR = {
  hive: "#0A0A0A",
  comb: "#1A1A1A",
  wax: "#2A2A2A",
  honey: "#F5C518",
  pollen: "#FFE066",
  sting: "#FF6B35",
  foreground: "#FAFAFA",
  muted: "#A1A1AA",
  emerald: "#34D399",
} as const;

const LEVEL_COLOR: Record<number, string> = {
  0: COLOR.honey, // root
  1: COLOR.pollen, // hook
  2: COLOR.honey, // audio
  3: COLOR.sting, // visual
  4: COLOR.foreground, // leaf
};

type Props = {
  data: GraphData;
  selectedNodeId: string | null;
  onSelect: (node: TreeNode | null) => void;
  /** Node IDs that should pulse for ~1.2s. Used to react to fresh conversions. */
  pulsingNodeIds?: Set<string>;
};

export function TreeGraph({
  data,
  selectedNodeId,
  onSelect,
  pulsingNodeIds,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 800, height: 520 });
  const [tick, setTick] = useState(0);

  // Track container size so the canvas matches the card it lives in.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Drive a simple animation clock so the pulse can rerender without forcing the lib to refit.
  useEffect(() => {
    if (!pulsingNodeIds || pulsingNodeIds.size === 0) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60);
    return () => window.clearInterval(id);
  }, [pulsingNodeIds]);

  // Auto-fit once the graph has settled.
  useEffect(() => {
    const t = window.setTimeout(() => fgRef.current?.zoomToFit(400, 60), 600);
    return () => window.clearTimeout(t);
  }, [data]);

  const graph = useMemo(() => data, [data]);

  return (
    <div ref={containerRef} className="h-[560px] w-full">
      <ForceGraph2D
        ref={fgRef}
        graphData={graph}
        width={size.width}
        height={size.height}
        backgroundColor={COLOR.hive}
        cooldownTicks={120}
        d3AlphaDecay={0.025}
        d3VelocityDecay={0.35}
        // Force the layout into a vertical hierarchy so levels read top-to-bottom.
        // Negative dy pulls children below their parent; positive y at root.
        dagMode="td"
        dagLevelDistance={90}
        // Look & feel of links
        linkColor={() => "rgba(245, 197, 24, 0.18)"}
        linkWidth={(link) => {
          const target = link.target as TreeNode;
          if (!target?.conversions) return 0.6;
          // Heavier line for high-traffic branches.
          return Math.min(3, 0.6 + Math.log(target.conversions + 1) * 0.7);
        }}
        linkDirectionalParticles={(link) => {
          const target = link.target as TreeNode;
          return target?.conversions && target.conversions > 0 ? 2 : 0;
        }}
        linkDirectionalParticleSpeed={() => 0.004}
        linkDirectionalParticleColor={() => COLOR.honey}
        // Custom node drawing: circle + glow + AI badge + label.
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as TreeNode & { x?: number; y?: number };
          if (n.x == null || n.y == null) return;

          const baseRadius =
            n.level === 0
              ? 14
              : n.level === 1
                ? 9 + Math.log(n.forks + 1) * 1.5
                : n.level === 4
                  ? 5
                  : 7 + Math.log(n.forks + 1) * 1.2;

          const isSelected = selectedNodeId === n.id;
          const isPulsing = pulsingNodeIds?.has(n.id) ?? false;
          const conversionGlow = Math.min(1, n.conversions / 20);

          // Pulse modifier: small radius bump on a sine wave for ~1.2s while pulsing.
          const pulseAmp = isPulsing ? 4 + Math.sin(tick * 0.4) * 2 : 0;
          const radius = baseRadius + pulseAmp;

          // Outer glow
          if (conversionGlow > 0 || isSelected || isPulsing) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, radius + 6, 0, Math.PI * 2);
            const glowColor = isPulsing
              ? COLOR.sting
              : isSelected
                ? COLOR.pollen
                : LEVEL_COLOR[n.level];
            const alpha = isPulsing
              ? 0.35
              : isSelected
                ? 0.4
                : 0.15 + conversionGlow * 0.25;
            ctx.fillStyle = withAlpha(glowColor, alpha);
            ctx.fill();
          }

          // Main circle
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = LEVEL_COLOR[n.level];
          ctx.fill();
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.strokeStyle = isSelected ? COLOR.foreground : COLOR.hive;
          ctx.stroke();

          // AI agent badge
          if (n.author === "agent") {
            ctx.beginPath();
            ctx.arc(n.x + radius * 0.7, n.y - radius * 0.7, 4, 0, Math.PI * 2);
            ctx.fillStyle = COLOR.emerald;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = COLOR.hive;
            ctx.stroke();
          }

          // Label below the node — only render past a certain zoom to avoid clutter.
          if (globalScale > 0.9 && n.level > 0) {
            const fontSize = 10 / globalScale;
            ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const label = truncate(n.title, 28);
            ctx.fillStyle = COLOR.muted;
            ctx.fillText(label, n.x, n.y + radius + 3);
          }
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as TreeNode & { x?: number; y?: number };
          if (n.x == null || n.y == null) return;
          const baseRadius =
            n.level === 0
              ? 14
              : n.level === 4
                ? 5
                : 7 + Math.log(n.forks + 1) * 1.2;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, baseRadius + 4, 0, Math.PI * 2);
          ctx.fill();
        }}
        nodeLabel={(node) => {
          const n = node as TreeNode;
          return `<div style="background:#141414;border:1px solid #2A2A2A;color:#FAFAFA;padding:6px 10px;border-radius:6px;font-family:Inter,system-ui;font-size:12px"><b>${escapeHtml(n.title)}</b><br/><span style="color:#A1A1AA">L${n.level} · @${escapeHtml(n.authorHandle)}${n.author === "agent" ? " 🤖" : ""}</span><br/><span style="color:#FF6B35">${n.conversions} conv · $${n.payoutUsdc.toFixed(2)}</span></div>`;
        }}
        onNodeClick={(node) => onSelect(node as TreeNode)}
        onBackgroundClick={() => onSelect(null)}
      />
    </div>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
