import { clsx } from "clsx";
import { ChangeEvent, useMemo, useRef, useState } from "react";

type Props = {
  name: string;
  accept?: string;
  placeholder?: string;
  hint?: string;
  className?: string;
  onFileSelect?: (file: File | null) => void;
};

export function FileUpload({ name, accept, placeholder = "拖拽或点击选择文件", hint, className, onFileSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  const displaySize = useMemo(() => {
    if (fileSize == null) return "";
    const kb = fileSize / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
  }, [fileSize]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : null);
    setFileSize(file ? file.size : null);
    onFileSelect?.(file ?? null);
  };

  return (
    <label
      className={clsx(
        "group relative flex w-full cursor-pointer flex-col gap-2 overflow-hidden rounded-xl border border-dashed border-border/60 bg-[radial-gradient(circle_at_top_left,#162032,#0c101c)] p-4 shadow-[0_0_0_1px_rgba(59,130,246,0.08)] transition-all hover:border-primary/60 hover:shadow-[0_12px_45px_rgba(59,130,246,0.25)]",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        onChange={handleChange}
      />
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/5 text-primary">
          ⬆
        </span>
        <div className="flex flex-col">
          <span className="text-foreground">{fileName || placeholder}</span>
          <span className="text-xs text-muted">
            {fileName ? displaySize || "已选择" : hint || "支持文本字典，单文件 ≤10MB"}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>点击更换 · 支持拖拽到此区域</span>
        {fileName && (
          <button
            type="button"
            className="relative z-20 text-[11px] uppercase tracking-wide text-primary underline underline-offset-2 transition hover:text-primary/80"
            onClick={(e) => {
              e.preventDefault();
              if (inputRef.current) {
                inputRef.current.value = "";
              }
              setFileName(null);
              setFileSize(null);
              onFileSelect?.(null);
            }}
          >
            清除
          </button>
        )}
      </div>
    </label>
  );
}
