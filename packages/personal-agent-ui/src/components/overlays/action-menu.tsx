import { useRef, type ReactElement, type ReactNode, type RefObject } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, MoreVertical } from "lucide-react";
import { IconButton } from "../icon-button";

export function ActionMenu({
  label,
  children,
  triggerRef,
  trigger,
  transferringFocus = false,
  onOpenChange,
}: {
  label: string;
  children: ReactNode;
  triggerRef?: RefObject<HTMLButtonElement>;
  trigger?: ReactElement;
  transferringFocus?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const pointerDismissed = useRef(false);
  return (
    <Menu.Root onOpenChange={(open) => {
      if (open) pointerDismissed.current = false;
      onOpenChange?.(open);
    }}>
      <Menu.Trigger asChild>
        {trigger ?? (
          <IconButton ref={triggerRef} label={label} icon={<MoreVertical />} />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="ui-action-menu"
          data-focus-transfer={transferringFocus || undefined}
          align="end"
          sideOffset={5}
          collisionPadding={8}
          onPointerDownOutside={() => { pointerDismissed.current = true; }}
          onCloseAutoFocus={(event) => {
            if (transferringFocus || pointerDismissed.current) event.preventDefault();
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
  download,
}: {
  children: ReactNode;
  href: string;
  external?: boolean;
  download?: boolean;
}) {
  return (
    <Menu.Item asChild className="ui-action-menu__item">
      <a
        href={href}
        download={download}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    </Menu.Item>
  );
}

export function ActionMenuSeparator() {
  return <Menu.Separator className="ui-action-menu__separator" />;
}

export function ActionMenuRadioGroup<T extends string>({
  label, value, options, onValueChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onValueChange: (value: T) => void;
}) {
  return <>
    <Menu.Label className="ui-action-menu__label">{label}</Menu.Label>
    <Menu.RadioGroup value={value} onValueChange={(next) => {
      const selected = options.find((option) => option.value === next);
      if (selected) onValueChange(selected.value);
    }}>
      {options.map((option) => <Menu.RadioItem key={option.value} value={option.value} className="ui-action-menu__item ui-action-menu__radio">
        <span className="ui-action-menu__indicator"><Menu.ItemIndicator><Check size={14} /></Menu.ItemIndicator></span>
        {option.label}
      </Menu.RadioItem>)}
    </Menu.RadioGroup>
  </>;
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
