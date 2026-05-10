import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] font-semibold transition-colors",
  {
    variants: {
      variant: {
        honey: "border-honey/30 bg-honey/10 text-honey",
        sting: "border-sting/30 bg-sting/10 text-sting",
        outline: "border-line bg-transparent text-muted",
        live: "border-live/30 bg-live/10 text-live",
      },
    },
    defaultVariants: {
      variant: "honey",
    },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
