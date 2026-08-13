import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "./button";

interface StatusViewProps {
  kind: "loading" | "empty" | "error";
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function StatusView({ kind, title, description, actionLabel, onAction }: StatusViewProps) {
  const Icon = kind === "loading" ? LoaderCircle : kind === "error" ? AlertCircle : Inbox;
  return (
    <div className="grid min-h-56 place-items-center px-6 py-12 text-center">
      <div className="max-w-xs">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[var(--surface-muted)] text-[var(--muted)]">
          <Icon className={kind === "loading" ? "animate-spin" : ""} size={20} />
        </span>
        <h3 className="mt-4 text-[15px] font-semibold">{title ?? (kind === "loading" ? "正在加载…" : "这里还没有内容")}</h3>
        {description ? <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
        {actionLabel && onAction ? <Button className="mt-5" onClick={onAction}>{actionLabel}</Button> : null}
      </div>
    </div>
  );
}
