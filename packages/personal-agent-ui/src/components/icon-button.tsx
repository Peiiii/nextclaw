import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Button } from "./button";
import type { TooltipSide } from "./overlays/tooltip";

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  label: string;
  icon: ReactNode;
  tooltip?: boolean | string;
  tooltipSide?: TooltipSide;
  feedback?: "plain" | "filled";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, tooltip = true, tooltipSide = "bottom", feedback = "plain", className = "", ...props }, ref) => <Button
      {...props}
      ref={ref}
      tone="icon"
      aria-label={label}
      tooltip={tooltip === true ? label : tooltip || false}
      tooltipSide={tooltipSide}
      className={`ui-icon-button ui-icon-button--${feedback} ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
    </Button>
);
IconButton.displayName = "IconButton";
