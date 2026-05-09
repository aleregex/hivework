"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Hand-rolled shadcn-style button. We skip the CLI to save setup time.
// Variants reflect the Hivework palette: honey (primary), sting (accent for money/conversions),
// outline (secondary), ghost (tertiary).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey/60 focus-visible:ring-offset-2 focus-visible:ring-offset-hive disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        honey:
          "bg-honey text-hive hover:bg-pollen shadow-[0_8px_24px_-12px_rgba(245,197,24,0.55)]",
        sting:
          "bg-sting text-foreground hover:bg-sting/90 shadow-[0_8px_24px_-12px_rgba(255,107,53,0.55)]",
        outline:
          "border border-wax bg-transparent text-foreground hover:bg-comb hover:border-honey/40",
        ghost: "text-foreground hover:bg-comb",
        link: "text-honey underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4 py-2",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "honey",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
