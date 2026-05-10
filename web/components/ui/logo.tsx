import { cn } from "@/lib/utils";

/**
 * Hivework wordmark — a hexagonal cell mark + monospace wordmark.
 * Replaces the 🐝 emoji we used in the v0 demo. Tone: developer tool, not toy.
 */
export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { hex: 18, gap: "gap-2", text: "text-sm" },
    md: { hex: 22, gap: "gap-2.5", text: "text-[15px]" },
    lg: { hex: 28, gap: "gap-3", text: "text-lg" },
  } as const;
  const s = sizes[size];

  return (
    <div className={cn("inline-flex items-center", s.gap, className)}>
      <HexMark size={s.hex} />
      <span
        className={cn(
          "font-mono font-medium tracking-tight text-foreground",
          s.text
        )}
      >
        hivework
        <span className="text-honey">/</span>
      </span>
    </div>
  );
}

export function HexMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M16 2.5 L27.5 9 L27.5 22 L16 28.5 L4.5 22 L4.5 9 Z"
        stroke="var(--honey)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M16 10 L21.6 13.2 L21.6 19.6 L16 22.8 L10.4 19.6 L10.4 13.2 Z"
        fill="var(--honey)"
      />
    </svg>
  );
}
