import { cn } from "@/lib/utils";

/**
 * Section header label. Looks like a code-comment / file-marker:
 *
 *   ── ID ─ TITLE ──────────────────────────
 *
 * Used to give every section a "module" feel, like rows in a node-graph editor.
 */
export function SectionLabel({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted",
        className
      )}
    >
      <span className="text-honey">{id}</span>
      <span aria-hidden className="h-px w-6 bg-line-strong" />
      <span>{children}</span>
    </div>
  );
}
