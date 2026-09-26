import { type ReactNode } from "react";

export function EmptyState({ title, detail, mark }: { title: string; detail?: string; mark?: ReactNode }) {
  return <div className="ui-empty-state">{mark && <span aria-hidden="true">{mark}</span>}<h2>{title}</h2>{detail && <p>{detail}</p>}</div>;
}
