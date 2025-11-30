import { clsx } from "clsx";
import { forwardRef, InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-lg border border-border/80 bg-[var(--surface-strong)] px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
