import type { PropsWithChildren } from "react";

type PanelProps = PropsWithChildren<{
  className?: string;
  id?: string;
}>;

export function Panel({ children, className = "", id }: PanelProps): JSX.Element {
  return (
    <section id={id} className={`panel ${className}`.trim()}>
      {children}
    </section>
  );
}
