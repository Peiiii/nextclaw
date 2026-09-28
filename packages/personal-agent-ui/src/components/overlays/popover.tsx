import { useMemo, useRef, type ReactElement, type ReactNode } from "react";
import * as Primitive from "@radix-ui/react-popover";

export function Popover({ open, onOpenChange, label, trigger, children, side = "bottom" }: {
  open: boolean; onOpenChange: (open: boolean) => void; label: string; trigger: ReactElement; children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return <Primitive.Root open={open} onOpenChange={onOpenChange}>
    <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
    <Primitive.Portal>
      <Primitive.Content className="ui-popover" aria-label={label} align="start" side={side} sideOffset={5} collisionPadding={8}>
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}

/** Contextual editor tools share the same collision and dismissal primitive. */
export function AnchoredPopover({ anchor, label, children, onClose, onReturnFocus, passive = false, side = "bottom", className = "" }: {
  anchor: { x: number; y: number; width: number; height: number }; label: string;
  children: ReactNode; onClose: () => void; passive?: boolean; side?: "top" | "bottom" | "left" | "right";
  className?: string;
  onReturnFocus?: () => void;
}) {
  const interactedOutside = useRef(false);
  const virtualRef = useMemo(() => ({ current: { getBoundingClientRect: () => DOMRect.fromRect(anchor) } }), [anchor]);
  return <Primitive.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Primitive.Anchor virtualRef={virtualRef} />
    <Primitive.Portal><Primitive.Content className={`ui-popover ui-markdown-context ${className}`} aria-label={label}
      align="start" side={side} sideOffset={8} collisionPadding={12}
      onOpenAutoFocus={event => { if (passive) event.preventDefault(); }}
      onCloseAutoFocus={event => { event.preventDefault(); if (!interactedOutside.current) onReturnFocus?.(); }}
      onInteractOutside={() => { interactedOutside.current = true; }}
      onFocusOutside={event => { if (passive) event.preventDefault(); }}>
      {children}
    </Primitive.Content></Primitive.Portal>
  </Primitive.Root>;
}
