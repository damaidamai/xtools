import { clsx } from "clsx";
import { forwardRef, SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, Props>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        className={clsx(
          "w-full appearance-none rounded-xl border border-border/80 bg-gradient-to-br from-[#111827] via-[#0f1626] to-[#0b1220] px-3 py-2.5 pr-10 text-sm text-foreground shadow-[0_0_0_1px_rgba(59,130,246,0.15)] outline-none transition-all focus:-translate-y-[1px] focus:border-primary focus:shadow-[0_8px_30px_rgba(59,130,246,0.25)] focus:ring-1 focus:ring-primary/30 hover:border-primary/70",
          "placeholder:text-muted",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">▾</span>
    </div>
  );
});
Select.displayName = "Select";
