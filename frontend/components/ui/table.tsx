import { clsx } from "clsx";
import { HTMLAttributes, TableHTMLAttributes } from "react";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={clsx("w-full border-collapse text-sm", className)} {...props} />;
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="text-left text-muted" {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TR(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className="border-b border-border last:border-none" {...props} />;
}

export function TH({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={clsx("px-3 py-2 font-medium text-xs uppercase tracking-wide", className)} {...props} />
  );
}

export function TD({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx("px-3 py-2", className)} {...props} />;
}
