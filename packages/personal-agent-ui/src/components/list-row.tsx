import { type ButtonHTMLAttributes, type ReactNode } from "react";

export function ListRow({ selected = false, className = "", children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; children: ReactNode }) {
  return <button {...props} type={type} aria-pressed={selected} className={`ui-list-row ${selected ? "is-selected" : ""} ${className}`.trim()}>{children}</button>;
}
