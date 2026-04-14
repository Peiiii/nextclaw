import type { PropsWithChildren } from "react";

export function AppRoot({ children }: PropsWithChildren): JSX.Element {
  return (
    <main className="portal-shell">
      <div className="portal-shell__glow portal-shell__glow--one" aria-hidden="true" />
      <div className="portal-shell__glow portal-shell__glow--two" aria-hidden="true" />
      <div className="portal-shell__content">
        {children}
      </div>
    </main>
  );
}
