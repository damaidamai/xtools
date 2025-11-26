import { clsx } from "clsx";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-border bg-surface p-4 shadow-subtle",
        className,
      )}
      {...props}
    />
  );
}
