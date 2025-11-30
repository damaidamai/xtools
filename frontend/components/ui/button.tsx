import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "md" | "sm";
  loading?: boolean;
  loadingText?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, loadingText, disabled, children, ...rest }, ref) => {
    const styles = clsx(
      "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all border shadow-subtle border-transparent",
      size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs",
      variant === "primary" &&
        "bg-primary text-[#0c1118] hover:bg-[var(--primary-soft)] hover:shadow-[0_14px_44px_-30px_rgba(143,182,255,0.8)]",
      variant === "ghost" &&
        "bg-[var(--surface-strong)] text-foreground border-border/70 hover:border-primary/60 hover:bg-[var(--surface)]",
      variant === "danger" && "bg-destructive text-white hover:bg-[#e87f7f]",
      (disabled || loading) && "opacity-60 cursor-not-allowed",
      className,
    );
    const spinner = (
      <span className="inline-flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
        <span>{loadingText ?? children}</span>
      </span>
    );
    return (
      <button ref={ref} className={styles} disabled={disabled || loading} {...rest}>
        {loading ? spinner : children}
      </button>
    );
  },
);
Button.displayName = "Button";
