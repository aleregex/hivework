"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Hand-rolled shadcn-style button, tuned for the Honeycomb OS palette.
// honey = primary. sting = money-in semantic. outline / ghost / link as usual.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        honey:
          "bg-honey text-ink hover:bg-honey-soft shadow-[0_10px_32px_-16px_rgba(255,176,32,0.65),inset_0_1px_0_rgba(255,255,255,0.18)]",
        sting:
          "bg-sting text-foreground hover:bg-sting/90 shadow-[0_10px_32px_-16px_rgba(255,107,53,0.6),inset_0_1px_0_rgba(255,255,255,0.18)]",
        outline:
          "border border-line bg-transparent text-foreground hover:bg-surface hover:border-honey/40",
        ghost: "text-fg-soft hover:bg-surface hover:text-foreground",
        link: "text-honey underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-[15px]",
        icon: "h-9 w-9",
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
