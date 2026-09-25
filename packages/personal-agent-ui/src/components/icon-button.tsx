import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button } from "./button";

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  label: string;
  icon: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, className = "", ...props }, ref) => (
    <Tooltip.Provider delayDuration={350}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button
            {...props}
            ref={ref}
            tone="icon"
            aria-label={label}
            className={`ui-icon-button ${className}`}
          >
            <span aria-hidden="true">{icon}</span>
          </Button>
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
    </Tooltip.Provider>
  )
);
IconButton.displayName = "IconButton";
