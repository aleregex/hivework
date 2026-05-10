"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { GraphData, TreeNode } from "@/lib/mocks/tree";

/* ------------------------------------------------------------------ *
 * Hivework tree — deterministic SVG renderer.
 *
 * We dropped react-force-graph because:
 *   1. Physics-based layout makes siblings overlap unpredictably.
 *   2. Labels collide because every node's label is drawn at the same
 *      Y offset relative to its node, with no awareness of neighbors.
 *   3. Canvas drawing makes it hard to use CSS variables for theming.
 *
 * Replacement: a tidy-tree layout (Reingold-Tilford simplified, "subtree
 * width" pass). Each subtree gets its own non-overlapping horizontal
 * slot, and labels live in fixed-width columns so they never collide.
 * Pan + zoom are applied via a single SVG transform; with hundreds of
 * nodes we still render in well under one frame.
 * ------------------------------------------------------------------ */

// ---------- Layout constants ---------- //

const X_GAP = 120; // horizontal slot width per leaf-equivalent
const Y_GAP = 118; // vertical distance between levels — tightened
const PADDING = 56; // outer margin around the full tree
const LABEL_WIDTH = 112; // px — labels truncate to fit this width

// ---------- Layout ---------- //

type Position = { x: number; y: number };
type LayoutResult = {
  positions: Map<string, Position>;
  width: number;
  height: number;
};

/** Tidy-tree layout: every subtree owns a non-overlapping range of slots. */
function layoutTree(nodes: TreeNode[]): LayoutResult {
  if (nodes.length === 0) {
    return { positions: new Map(), width: 0, height: 0 };
  }
  const byParent = new Map<string | null, TreeNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }
  // Stable sibling order so the layout doesn't jump on re-renders.
  for (const arr of byParent.values()) {
    arr.sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  const root = nodes.find((n) => n.parentId === null) ?? nodes[0];

  // Pass 1: compute subtree width in "slots" (1 slot = X_GAP px).
  const widths = new Map<string, number>();
  const measure = (id: string): number => {
    const children = byParent.get(id) ?? [];
    if (children.length === 0) {
      widths.set(id, 1);
      return 1;
    }
    const w = children.reduce((acc, c) => acc + measure(c.id), 0);
    widths.set(id, Math.max(1, w));
    return widths.get(id) ?? 1;
  };
  measure(root.id);

  // Pass 2: assign each node an absolute x by recursing left-to-right.
  const positions = new Map<string, Position>();
  const assign = (id: string, leftSlot: number, level: number): number => {
    const children = byParent.get(id) ?? [];
    const w = widths.get(id) ?? 1;
    if (children.length === 0) {
      const x = (leftSlot + 0.5) * X_GAP;
      positions.set(id, { x, y: level * Y_GAP });
      return leftSlot + w;
    }
    let cursor = leftSlot;
    const centers: number[] = [];
    for (const c of children) {
      const cw = widths.get(c.id) ?? 1;
      const childCenter = (cursor + cw / 2) * X_GAP;
      centers.push(childCenter);
      assign(c.id, cursor, level + 1);
      cursor += cw;
    }
    const x = (centers[0] + centers[centers.length - 1]) / 2;
    positions.set(id, { x, y: level * Y_GAP });
    return cursor;
  };
  assign(root.id, 0, 0);

  let maxX = 0;
  let maxY = 0;
  for (const { x, y } of positions.values()) {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return {
    positions,
    width: maxX + X_GAP,
    height: maxY + Y_GAP,
  };
}

// ---------- Visual constants ---------- //

const LEVEL_LABEL: Record<number, string> = {
  0: "campaign",
  1: "hook",
  2: "audio",
  3: "visual",
  4: "post",
};

const LEVEL_FILL: Record<number, string> = {
  0: "var(--honey)",
  1: "var(--honey)",
  2: "var(--honey-soft)",
  3: "var(--sting)",
  4: "var(--surface-2)",
};

const LEVEL_TEXT: Record<number, string> = {
  0: "var(--ink)",
  1: "var(--ink)",
  2: "var(--ink)",
  3: "var(--ink)",
  4: "var(--foreground)",
};

const LEVEL_STROKE: Record<number, string> = {
  0: "var(--honey-deep)",
  1: "var(--honey-deep)",
  2: "var(--honey-deep)",
  3: "var(--sting)",
  4: "var(--line-strong)",
};

/** Pointy-top hex centered at (0,0) with given size (corner radius). */
function hexPath(size: number): string {
  const h = size; // distance from center to top/bottom corner
  const w = (size * Math.sqrt(3)) / 2; // distance from center to side flats
  return `M 0 ${-h} L ${w} ${-h / 2} L ${w} ${h / 2} L 0 ${h} L ${-w} ${h / 2} L ${-w} ${-h / 2} Z`;
}

function hexSize(node: TreeNode): number {
  if (node.level === 0) return 26;
  if (node.level === 4) return 13;
  // Slightly grow with forks so popular branches stand out
  return 16 + Math.log(node.forks + 1) * 1.4;
}

// ---------- Component ---------- //

type Props = {
  data: GraphData;
  selectedNodeId: string | null;
  onSelect: (node: TreeNode | null) => void;
  pulsingNodeIds?: Set<string>;
  cascadeMode?: boolean;
  /**
   * When set, only nodes in this set are clickable + rendered at full opacity.
   * The rest are dimmed. Used by the publish-leaf flow so the influencer can
   * see the whole tree but the cursor only "wins" on the eligible step.
   */
  selectableNodeIds?: Set<string>;
  /** IDs that should render with a confirmed/locked-in look (publish flow steps). */
  highlightedNodeIds?: Set<string>;
};

export function TreeGraph({
  data,
  selectedNodeId,
  onSelect,
  pulsingNodeIds,
  cascadeMode = false,
  selectableNodeIds,
  highlightedNodeIds,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 560 });
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  );

  // ResizeObserver to keep the SVG matching its container.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ w: width, h: height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => layoutTree(data.nodes), [data.nodes]);

  // Auto-fit whenever the tree changes shape OR the container resizes.
  useEffect(() => {
    if (layout.width === 0) return;
    const innerW = containerSize.w - PADDING * 2;
    const innerH = containerSize.h - PADDING * 2;
    if (innerW <= 0 || innerH <= 0) return;
    const scale = Math.min(
      1,
      Math.min(innerW / layout.width, innerH / layout.height)
    );
    const tx = (containerSize.w - layout.width * scale) / 2;
    const ty = PADDING * scale;
    setView({ scale, tx, ty });
  }, [layout.width, layout.height, containerSize.w, containerSize.h]);

  // ----- Pan + zoom interaction ----- //

  const onWheel = useCallback((e: ReactWheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      const nextScale = Math.min(2.5, Math.max(0.2, v.scale * (1 + delta)));
      const k = nextScale / v.scale;
      return {
        scale: nextScale,
        tx: mx - (mx - v.tx) * k,
        ty: my - (my - v.ty) * k,
      };
    });
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest("[data-node]")) return; // clicking a node, not panning
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      tx: view.tx,
      ty: view.ty,
    };
  }, [view.tx, view.ty]);

  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setView((v) => ({
      ...v,
      tx: dragRef.current!.tx + dx,
      ty: dragRef.current!.ty + dy,
    }));
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const fit = useCallback(() => {
    if (layout.width === 0) return;
    const innerW = containerSize.w - PADDING * 2;
    const innerH = containerSize.h - PADDING * 2;
    const scale = Math.min(
      1,
      Math.min(innerW / layout.width, innerH / layout.height)
    );
    const tx = (containerSize.w - layout.width * scale) / 2;
    const ty = PADDING * scale;
    setView({ scale, tx, ty });
  }, [layout.width, layout.height, containerSize.w, containerSize.h]);

  // Build link list: each link is from a node to its parent's position.
  const links = useMemo(() => {
    return data.nodes
      .filter((n) => n.parentId !== null)
      .map((child) => {
        const parent = layout.positions.get(child.parentId as string);
        const c = layout.positions.get(child.id);
        if (!parent || !c) return null;
        return { id: child.id, parent, child: c, conversions: child.conversions };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data.nodes, layout.positions]);

  return (
    <div ref={containerRef} className="bg-dot-grid relative h-[640px] w-full">
      {/* Toolbar — controls in the corner like a graph editor */}
      <Toolbar
        scale={view.scale}
        onZoomIn={() =>
          setView((v) => ({ ...v, scale: Math.min(2.5, v.scale * 1.2) }))
        }
        onZoomOut={() =>
          setView((v) => ({ ...v, scale: Math.max(0.2, v.scale / 1.2) }))
        }
        onFit={fit}
        nodeCount={data.nodes.length}
      />

      <svg
        width={containerSize.w}
        height={containerSize.h}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if ((e.target as Element).closest("[data-node]")) return;
          onSelect(null);
        }}
        className={`absolute inset-0 ${dragRef.current ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "none" }}
      >
        <defs>
          {/* A soft glow filter we apply to selected/pulsing nodes. */}
          <filter id="hex-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}
        >
          {/* Wires (connectors) — drawn first so nodes render on top. */}
          <g className="wires">
            {links.map((l) => {
              const isHot = l.conversions > 0;
              const stroke = cascadeMode
                ? "var(--honey)"
                : isHot
                  ? "var(--honey)"
                  : "var(--line-strong)";
              const opacity = cascadeMode ? 0.7 : isHot ? 0.55 : 0.45;
              const width = cascadeMode
                ? 1.6
                : isHot
                  ? 1 + Math.min(2, Math.log(l.conversions + 1) * 0.5)
                  : 1;
              const path = wirePath(l.parent, l.child);
              return (
                <g key={l.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={stroke}
                    strokeOpacity={opacity}
                    strokeWidth={width}
                    strokeLinecap="round"
                  />
                  {(cascadeMode || isHot) && (
                    <circle
                      r={cascadeMode ? 3 : 2.2}
                      fill={cascadeMode ? "var(--honey-soft)" : "var(--honey)"}
                    >
                      <animateMotion
                        dur={cascadeMode ? "1.2s" : "2.4s"}
                        repeatCount="indefinite"
                        path={path}
                      />
                    </circle>
                  )}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {data.nodes.map((n) => {
              const pos = layout.positions.get(n.id);
              if (!pos) return null;
              const dimmed =
                selectableNodeIds !== undefined &&
                !selectableNodeIds.has(n.id) &&
                !(highlightedNodeIds?.has(n.id) ?? false);
              return (
                <Node
                  key={n.id}
                  node={n}
                  pos={pos}
                  selected={selectedNodeId === n.id}
                  pulsing={pulsingNodeIds?.has(n.id) ?? false}
                  cascade={cascadeMode}
                  dimmed={dimmed}
                  highlighted={highlightedNodeIds?.has(n.id) ?? false}
                  selectable={selectableNodeIds?.has(n.id) ?? false}
                  hasSelectableMode={selectableNodeIds !== undefined}
                  onClick={() => {
                    if (
                      selectableNodeIds !== undefined &&
                      !selectableNodeIds.has(n.id)
                    ) {
                      return;
                    }
                    onSelect(n);
                  }}
                />
              );
            })}
          </g>
        </g>
      </svg>

      {/* Helper hint, bottom-left */}
      <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        drag · scroll · click
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Connector path. We use a smooth S-curve (cubic bezier) so the tree
 * reads like a node-graph editor (Linear/Reactflow vibe), not a spider
 * web. Vertical bias makes parents/children visually paired.
 * ------------------------------------------------------------------ */
function wirePath(p: Position, c: Position): string {
  const midY = (p.y + c.y) / 2;
  return `M ${p.x} ${p.y} C ${p.x} ${midY}, ${c.x} ${midY}, ${c.x} ${c.y}`;
}

/* ------------------------------------------------------------------ *
 * Node — hexagonal cell + label below.
 * ------------------------------------------------------------------ */
function Node({
  node,
  pos,
  selected,
  pulsing,
  cascade,
  dimmed,
  highlighted,
  selectable,
  hasSelectableMode,
  onClick,
}: {
  node: TreeNode;
  pos: Position;
  selected: boolean;
  pulsing: boolean;
  cascade: boolean;
  dimmed: boolean;
  highlighted: boolean;
  selectable: boolean;
  hasSelectableMode: boolean;
  onClick: () => void;
}) {
  const size = hexSize(node);
  const fill = LEVEL_FILL[node.level];
  const stroke = LEVEL_STROKE[node.level];
  const text = LEVEL_TEXT[node.level];
  const showGlow =
    !dimmed &&
    (selected || pulsing || cascade || highlighted || node.conversions > 0);
  const cursor = dimmed
    ? "cursor-not-allowed"
    : selectable
      ? "cursor-pointer"
      : hasSelectableMode
        ? "cursor-default"
        : "cursor-pointer";

  return (
    <g
      data-node={node.id}
      transform={`translate(${pos.x} ${pos.y})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cursor}
      style={{ opacity: dimmed ? 0.22 : 1, transition: "opacity 0.25s ease" }}
    >
      {/* Outer glow ring — only for nodes that need to read "important" */}
      {showGlow && (
        <path
          d={hexPath(size + 8)}
          fill="none"
          stroke={
            pulsing
              ? "var(--sting)"
              : highlighted
                ? "var(--honey)"
                : selected
                  ? "var(--honey-soft)"
                  : "var(--honey)"
          }
          strokeOpacity={
            pulsing
              ? 0.7
              : highlighted
                ? 0.85
                : selected
                  ? 0.6
                  : cascade
                    ? 0.5
                    : 0.25
          }
          strokeWidth={pulsing || cascade || highlighted ? 2 : 1.2}
          filter="url(#hex-glow)"
        >
          {(pulsing || cascade) && (
            <animate
              attributeName="stroke-opacity"
              values="0.2;0.8;0.2"
              dur={cascade ? "1.4s" : "1s"}
              repeatCount="indefinite"
            />
          )}
        </path>
      )}

      {/* Selectable pulse — a soft breathing ring on eligible nodes during publish flow */}
      {selectable && !highlighted && (
        <path
          d={hexPath(size + 5)}
          fill="none"
          stroke="var(--honey)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.4;0.9;0.4"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* Main hex */}
      <path
        d={hexPath(size)}
        fill={fill}
        stroke={
          highlighted
            ? "var(--foreground)"
            : selected
              ? "var(--foreground)"
              : stroke
        }
        strokeWidth={highlighted ? 2.5 : selected ? 2 : 1}
      />

      {/* Inner small hex for the root (visual signature) */}
      {node.level === 0 && (
        <path
          d={hexPath(size * 0.5)}
          fill="var(--ink)"
          fillOpacity="0.85"
        />
      )}

      {/* Level marker inside hex */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={node.level === 0 ? 10 : node.level === 4 ? 8 : 9}
        fontFamily="var(--font-mono), monospace"
        fontWeight={600}
        fill={node.level === 0 ? "var(--honey)" : text}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {node.level === 0 ? "ROOT" : `L${node.level}`}
      </text>

      {/* Agent badge — small green hex top-right */}
      {node.author === "agent" && (
        <g transform={`translate(${size * 0.75} ${-size * 0.75})`}>
          <circle r={5} fill="var(--ink)" />
          <circle r={3.5} fill="var(--live)" />
        </g>
      )}

      {/* Conversion badge — top-right counter when there are conversions */}
      {node.conversions > 0 && node.author !== "agent" && node.level !== 0 && (
        <g transform={`translate(${size * 0.85} ${-size * 0.85})`}>
          <circle r={8} fill="var(--ink)" stroke="var(--sting)" strokeWidth={1} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fontFamily="var(--font-mono), monospace"
            fontWeight={700}
            fill="var(--sting)"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {node.conversions}
          </text>
        </g>
      )}

      {/* Label below hex */}
      <foreignObject
        x={-LABEL_WIDTH / 2}
        y={size + 6}
        width={LABEL_WIDTH}
        height={48}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="flex flex-col items-center gap-0.5 text-center"
          style={{ pointerEvents: "none" }}
        >
          <span
            className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground"
            style={{ overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {node.title}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
            {LEVEL_LABEL[node.level]} · @{shortHandle(node.authorHandle)}
          </span>
        </div>
      </foreignObject>

      <title>{`${node.title}\nL${node.level} · @${node.authorHandle}${node.author === "agent" ? " (AI agent)" : ""}\n${node.conversions} conversions · $${node.payoutUsdc.toFixed(2)} earned`}</title>
    </g>
  );
}

function shortHandle(handle: string): string {
  return handle.length > 14 ? handle.slice(0, 13) + "…" : handle;
}

/* ------------------------------------------------------------------ *
 * Toolbar overlay — zoom controls + node count.
 * ------------------------------------------------------------------ */
function Toolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onFit,
  nodeCount,
}: {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  nodeCount: number;
}) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2">
      <div className="pointer-events-auto inline-flex items-center divide-x divide-line rounded-md border border-line bg-surface/90 font-mono text-[11px] text-muted backdrop-blur">
        <button
          type="button"
          onClick={onZoomOut}
          className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-surface-2 hover:text-foreground"
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={onFit}
          className="flex h-7 items-center justify-center px-2.5 tabular transition-colors hover:bg-surface-2 hover:text-foreground"
          title="Fit to view"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-surface-2 hover:text-foreground"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border border-line bg-surface/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted backdrop-blur">
        <span className="tabular text-foreground">{nodeCount}</span>
        <span>nodes</span>
      </div>
    </div>
  );
}
