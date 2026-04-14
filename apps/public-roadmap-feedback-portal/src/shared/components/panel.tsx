import type { PropsWithChildren } from "react";

type PanelProps = PropsWithChildren<{
  className?: string;
}>;

export function Panel({ children, className = "" }: PanelProps): JSX.Element {
  return (
    <section className={`panel ${className}`.trim()}>
      {children}
    </section>
  );
}
