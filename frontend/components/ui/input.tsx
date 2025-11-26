import { clsx } from "clsx";
import { forwardRef, InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-lg border border-border bg-[#181818] px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
