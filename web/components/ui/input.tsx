import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // Base. Placeholder kept noticeably dimmer than real input text
          // (placeholder:text-faint) so users don't mistake the example for a
          // pre-filled value — that was confusing on the first screen.
          "flex h-10 w-full rounded-md border border-line bg-ink-2 px-3 py-2 text-sm text-foreground placeholder:text-faint placeholder:font-normal transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey/40 focus-visible:border-honey/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // aria-invalid styling, set by the form when validation fails.
          "aria-[invalid=true]:border-error/60 aria-[invalid=true]:focus-visible:ring-error/30",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
