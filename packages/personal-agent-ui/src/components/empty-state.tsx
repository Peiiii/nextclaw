import { type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export function LoadingState({ label }: { label: string }) {
  return <div className="ui-loading-state" role="status" aria-label={label}>
    <LoaderCircle size={20} aria-hidden="true" className="motion-safe:animate-spin" />
  </div>;
}

export function EmptyState({ title, detail, mark }: { title: string; detail?: string; mark?: ReactNode }) {
  return <div className="ui-empty-state">{mark && <span aria-hidden="true">{mark}</span>}<h2>{title}</h2>{detail && <p>{detail}</p>}</div>;
}
