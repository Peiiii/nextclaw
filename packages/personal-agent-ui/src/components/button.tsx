import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "quiet" | "text" | "danger" | "icon";
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ tone = "quiet", className = "", type = "button", children, ...props }, ref) =>
    <button ref={ref} type={type} className={`ui-button shrink-0 cursor-pointer whitespace-nowrap border-0 rounded-[var(--ui-radius-sm)] bg-transparent px-[11px] py-2 text-primary text-xs leading-[1.4] [font-family:inherit] ui-button--${tone} ${className}`.trim()} {...props}>{children}</button>,
);
Button.displayName = "Button";
