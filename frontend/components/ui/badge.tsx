import { clsx } from "clsx";
import { HTMLAttributes } from "react";

type Variant = "neutral" | "info" | "success" | "danger";

const variantMap: Record<Variant, string> = {
  neutral: "text-foreground border-border",
  info: "text-blue-300 border-blue-500/60",
  success: "text-green-300 border-green-500/60",
  danger: "text-red-300 border-red-500/60",
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        variantMap[variant],
        className,
      )}
      {...props}
    />
  );
}
