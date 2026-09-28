import { type ButtonHTMLAttributes, type ReactNode } from "react";

export function ListRow({ selected = false, variant = "list", className = "", children, leadingAction, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; variant?: "list" | "card"; children: ReactNode; leadingAction?: ReactNode }) {
  const row = <button {...props} type={type} aria-pressed={selected} className={`ui-list-row ui-list-row--${variant} ${selected ? "is-selected" : ""} ${className}`.trim()}>{children}</button>;
  return leadingAction ? <div className={`ui-list-row-group${selected ? " is-selected" : ""}`}>{leadingAction}{row}</div> : row;
}

export function RowActionTray({ children }: { children: ReactNode }) {
  return <div className="ui-row-action-tray">{children}</div>;
}
