import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          // Match Input's placeholder dimming + invalid styling so error
          // states are consistent across the form.
          "flex min-h-[80px] w-full rounded-md border border-line bg-ink-2 px-3 py-2 text-sm text-foreground placeholder:text-faint placeholder:font-normal transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey/40 focus-visible:border-honey/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-error/60 aria-[invalid=true]:focus-visible:ring-error/30",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
