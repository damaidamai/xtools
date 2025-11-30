import { clsx } from "clsx";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-border/80 bg-surface p-4 shadow-subtle",
        className,
      )}
      {...props}
    />
  );
}

Card.Header = function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between pb-4 mb-4 border-b border-border/50",
        className,
      )}
      {...props}
    />
  );
};

Card.Content = function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "",
        className,
      )}
      {...props}
    />
  );
};
