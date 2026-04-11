import type { ReactNode } from "react";

type PanelProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function Panel({ eyebrow, title, subtitle, actions, children }: PanelProps): JSX.Element {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <div className="panel__eyebrow">{eyebrow}</div>
          <h2 className="panel__title">{title}</h2>
          <p className="panel__subtitle">{subtitle}</p>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
