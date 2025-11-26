import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "md" | "sm";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...rest }, ref) => {
    const styles = clsx(
      "rounded-lg font-semibold transition-colors border border-transparent",
      size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs",
      variant === "primary" && "bg-primary text-black hover:bg-blue-400",
      variant === "ghost" && "bg-surface text-foreground border-border hover:border-blue-500",
      variant === "danger" && "bg-destructive text-white hover:bg-red-500",
      (disabled || loading) && "opacity-60 cursor-not-allowed",
      className,
    );
    return (
      <button ref={ref} className={styles} disabled={disabled || loading} {...rest}>
        {loading ? "…" : children}
      </button>
    );
  },
);
Button.displayName = "Button";
