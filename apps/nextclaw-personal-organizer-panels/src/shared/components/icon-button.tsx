import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: "default" | "danger";
}

export function IconButton({
  label,
  children,
  tone = "default",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`focus-ring inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${tone === "danger" ? "text-[var(--danger)] hover:bg-[var(--danger-soft)]" : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
