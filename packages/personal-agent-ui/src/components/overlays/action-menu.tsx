import type { ReactElement, ReactNode, RefObject } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";
import { IconButton } from "../icon-button";

export function ActionMenu({
  label,
  children,
  triggerRef,
  trigger,
  transferringFocus = false,
}: {
  label: string;
  children: ReactNode;
  triggerRef?: RefObject<HTMLButtonElement>;
  trigger?: ReactElement;
  transferringFocus?: boolean;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        {trigger ?? (
          <IconButton ref={triggerRef} label={label} icon={<MoreVertical />} />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="ui-action-menu"
          align="end"
          sideOffset={5}
          collisionPadding={8}
          onCloseAutoFocus={(event) => {
            if (transferringFocus) event.preventDefault();
          }}
        >
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function ActionMenuLink({
  children,
  href,
  external = false,
}: {
  children: ReactNode;
  href: string;
  external?: boolean;
}) {
  return (
    <Menu.Item asChild className="ui-action-menu__item">
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    </Menu.Item>
  );
}

export function ActionMenuItem({
  children,
  onSelect,
  disabled,
  danger = false,
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Menu.Item
      className={`ui-action-menu__item${danger ? " is-danger" : ""}`}
      disabled={disabled}
      onSelect={onSelect}
    >
      {children}
    </Menu.Item>
  );
}
