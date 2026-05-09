export function TreeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
      <LegendDot color="bg-honey" label="Root · campaign" />
      <LegendDot color="bg-pollen" label="L1 · Hook" />
      <LegendDot color="bg-honey" label="L2 · Audio" />
      <LegendDot color="bg-sting" label="L3 · Visual" />
      <LegendDot color="bg-foreground" label="L4 · Leaf" />
      <span className="ml-3 inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-comb" />
        <span>AI agent author</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-sting/50 shadow-[0_0_6px_rgba(255,107,53,0.8)]" />
        <span>Conversion incoming</span>
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  );
}
