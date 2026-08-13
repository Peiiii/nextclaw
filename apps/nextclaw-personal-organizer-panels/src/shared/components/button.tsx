import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

const toneClassNames: Record<ButtonTone, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 disabled:hover:opacity-50",
  secondary: "bg-[var(--surface-muted)] text-[var(--text)] hover:bg-[var(--surface-strong)]",
  ghost: "bg-transparent text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] hover:brightness-95",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  icon?: ReactNode;
}

export function Button({
  tone = "secondary",
  icon,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClassNames[tone]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
