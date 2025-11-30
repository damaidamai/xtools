import { clsx } from "clsx";
import { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Modal({ open, title, description, onClose, footer, className, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          "w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-subtle",
          className,
        )}
      >
        <div className="flex items-start justify-between border-b border-border/60 px-4 py-3">
          <div>
            {description && <div className="text-[12px] uppercase text-muted tracking-wide">{description}</div>}
            {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-border/60 text-sm text-muted hover:border-primary/60 hover:text-foreground"
            aria-label="关闭"
          >
            X
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
