import { clsx } from "clsx";
import { forwardRef, SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, Props>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={clsx(
        "w-full rounded-lg border border-border bg-[#181818] px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";
