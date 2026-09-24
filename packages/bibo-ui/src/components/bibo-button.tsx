import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type BiboButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "quiet" | "danger";
  children: ReactNode;
};

export const BiboButton = forwardRef<HTMLButtonElement, BiboButtonProps>(
  ({ tone = "quiet", className = "", type = "button", children, ...props }, ref) =>
    <button ref={ref} type={type} className={`bibo-button bibo-button--${tone} ${className}`.trim()} {...props}>{children}</button>,
);
BiboButton.displayName = "BiboButton";
