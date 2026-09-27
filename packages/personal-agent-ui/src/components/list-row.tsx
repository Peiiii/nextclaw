import { type ButtonHTMLAttributes, type ReactNode } from "react";

export function ListRow({ selected = false, className = "", children, leadingAction, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; children: ReactNode; leadingAction?: ReactNode }) {
  const row = <button {...props} type={type} aria-pressed={selected} className={`ui-list-row ${selected ? "is-selected" : ""} ${className}`.trim()}>{children}</button>;
  return leadingAction ? <div className={`ui-list-row-group${selected ? " is-selected" : ""}`}>{leadingAction}{row}</div> : row;
}
