import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Hivework wordmark — display serif "Hivework" sitting next to the honey hex
 * mark. No trailing slash, no lowercase quirk: the brand reads as a real
 * product, not a CLI namespace.
 */
export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { mark: 22, gap: "gap-2", text: "text-[15px]" },
    md: { mark: 28, gap: "gap-2.5", text: "text-[18px]" },
    lg: { mark: 38, gap: "gap-3", text: "text-[22px]" },
  } as const;
  const s = sizes[size];

  return (
    <div className={cn("inline-flex items-center", s.gap, className)}>
      <HexMark size={s.mark} />
      <span
        className={cn(
          "font-display font-semibold leading-none tracking-[-0.015em] text-foreground",
          s.text
        )}
        style={{ fontVariationSettings: '"opsz" 60, "SOFT" 50' }}
      >
        Hivework
      </span>
    </div>
  );
}

export function HexMark({
  size = 26,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      priority
    />
  );
}
