import type { ReactElement, ReactNode } from "react";
import * as Primitive from "@radix-ui/react-popover";

export function Popover({ open, onOpenChange, label, trigger, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; label: string; trigger: ReactElement; children: ReactNode;
}) {
  return <Primitive.Root open={open} onOpenChange={onOpenChange}>
    <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
    <Primitive.Portal>
      <Primitive.Content className="ui-popover" aria-label={label} align="start" sideOffset={5} collisionPadding={8}>
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}
