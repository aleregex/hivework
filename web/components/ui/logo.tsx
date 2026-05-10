import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Hivework wordmark — uses /public/logo.png (a honey hex with 6 satellite hexes
 * connected by edges, which literally reads as "hive + node graph").
 */
export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { mark: 22, gap: "gap-2", text: "text-sm" },
    md: { mark: 26, gap: "gap-2.5", text: "text-[15px]" },
    lg: { mark: 36, gap: "gap-3", text: "text-lg" },
  } as const;
  const s = sizes[size];

  return (
    <div className={cn("inline-flex items-center", s.gap, className)}>
      <HexMark size={s.mark} />
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
