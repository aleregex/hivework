/* Legend for the tree graph. Hex shapes match the node visuals exactly so
 * the legend reads as "this is what those things on the canvas mean."
 * Compact mono row to feel like a status bar, not a marketing element. */

const ITEMS: Array<{
  level: 0 | 1 | 2 | 3 | 4 | "agent" | "conv";
  label: string;
}> = [
  { level: 0, label: "campaign" },
  { level: 1, label: "L1 · hook" },
  { level: 2, label: "L2 · audio" },
  { level: 3, label: "L3 · visual" },
  { level: 4, label: "L4 · leaf" },
  { level: "agent", label: "ai agent" },
  { level: "conv", label: "conversion" },
];

export function TreeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-line bg-surface/60 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
      {ITEMS.map((it) => (
        <span key={String(it.level)} className="inline-flex items-center gap-2">
          <Glyph kind={it.level} />
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

function hex(size: number) {
  const h = size;
  const w = (size * Math.sqrt(3)) / 2;
  return `M 0 ${-h} L ${w} ${-h / 2} L ${w} ${h / 2} L 0 ${h} L ${-w} ${h / 2} L ${-w} ${-h / 2} Z`;
}

function Glyph({
  kind,
}: {
  kind: 0 | 1 | 2 | 3 | 4 | "agent" | "conv";
}) {
  if (kind === "agent") {
    return (
      <span className="relative inline-block h-2 w-2 rounded-full bg-live ring-1 ring-ink" />
    );
  }
  if (kind === "conv") {
    return (
      <span className="relative inline-block h-2 w-2 rounded-full bg-sting shadow-[0_0_6px_rgba(255,107,53,0.8)]" />
    );
  }
  const fill =
    kind === 0
      ? "var(--honey)"
      : kind === 1
        ? "var(--honey)"
        : kind === 2
          ? "var(--honey-soft)"
          : kind === 3
            ? "var(--sting)"
            : "var(--surface-2)";
  const stroke =
    kind === 3
      ? "var(--sting)"
      : kind === 4
        ? "var(--line-strong)"
        : "var(--honey-deep)";
  const size = 5;
  return (
    <svg
      width={12}
      height={12}
      viewBox="-6 -6 12 12"
      aria-hidden
      className="shrink-0"
    >
      <path d={hex(size)} fill={fill} stroke={stroke} strokeWidth={1} />
    </svg>
  );
}
