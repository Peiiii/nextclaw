import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Tooltip, type TooltipSide } from "./overlays/tooltip";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "quiet" | "text" | "danger" | "icon";
  children: ReactNode;
  tooltip?: string | false;
  tooltipSide?: TooltipSide;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ tone = "quiet", className = "", type = "button", children, tooltip, tooltipSide, title, ...props }, ref) => {
    const button = <button ref={ref} type={type} className={`ui-button ui-button--${tone} ${className}`.trim()} {...props}>{children}</button>;
    const label = tooltip === false ? "" : tooltip ?? title ?? "";
    return label ? <Tooltip label={label} side={tooltipSide}>{button}</Tooltip> : button;
  },
);
Button.displayName = "Button";
