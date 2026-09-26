import { forwardRef, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button } from "./button";

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  label: string;
  icon: ReactNode;
  tooltip?: boolean;
};

const hoverQuery = "(hover: hover) and (pointer: fine)";
const canHover = () => window.matchMedia(hoverQuery).matches;
const subscribeToHover = (notify: () => void) => {
  const media = window.matchMedia(hoverQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, tooltip = true, className = "", ...props }, ref) => {
    const hover = useSyncExternalStore(subscribeToHover, canHover, () => false);
    const trigger = <Button
      {...props}
      ref={ref}
      tone="icon"
      aria-label={label}
      className={`ui-icon-button ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
    </Button>;
    if (!tooltip) return trigger;
    return <Tooltip.Provider delayDuration={350}>
      <Tooltip.Root open={hover ? undefined : false}>
        <Tooltip.Trigger asChild>
          {trigger}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="ui-tooltip"
            side="top"
            sideOffset={6}
            collisionPadding={8}
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>;
  }
);
IconButton.displayName = "IconButton";
