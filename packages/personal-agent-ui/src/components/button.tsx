import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "quiet" | "text" | "danger" | "icon";
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ tone = "quiet", className = "", type = "button", children, ...props }, ref) =>
    <button ref={ref} type={type} className={`ui-button ui-button--${tone} ${className}`.trim()} {...props}>{children}</button>,
);
Button.displayName = "Button";
