import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, detail, action }: { eyebrow?: string; title: string; detail?: string; action?: ReactNode }) {
  return <header className="ui-page-header"><div>{eyebrow && <p className="ui-page-header__eyebrow">{eyebrow}</p>}<h1>{title}</h1>{detail && <p className="ui-page-header__detail">{detail}</p>}</div>{action}</header>;
}
