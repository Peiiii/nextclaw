import { useState, useSyncExternalStore, type ReactElement } from "react";
import * as Primitive from "@radix-ui/react-tooltip";

export type TooltipSide = "top" | "right" | "bottom" | "left";
const hoverQuery = "(hover: hover) and (pointer: fine)";
const canHover = () => window.matchMedia(hoverQuery).matches;
const subscribeToHover = (notify: () => void) => {
  const media = window.matchMedia(hoverQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export function Tooltip({ label, children, side = "bottom", enabled = true, onlyWhenTruncated = false }: {
  label: string;
  children: ReactElement;
  side?: TooltipSide;
  enabled?: boolean;
  onlyWhenTruncated?: boolean;
}) {
  const hover = useSyncExternalStore(subscribeToHover, canHover, () => false);
  const popupOpen = children.props["aria-haspopup"] && children.props["aria-expanded"] === true;
  const allowed = hover && enabled && !popupOpen;
  const [hint, setHint] = useState({ allowed, open: false });
  if (hint.allowed !== allowed) setHint({ allowed, open: false });
  const needsHint = (element: HTMLElement) => !onlyWhenTruncated || [element, ...Array.from(element.querySelectorAll<HTMLElement>("span"))]
    .some((part) => part.scrollWidth > part.clientWidth);
  return <Primitive.Provider delayDuration={350} skipDelayDuration={100} disableHoverableContent>
    <Primitive.Root open={allowed && hint.open} onOpenChange={(open) => setHint({ allowed, open })}>
      <Primitive.Trigger asChild onPointerMove={(event) => {
        if (!needsHint(event.currentTarget)) event.preventDefault();
      }} onFocus={(event) => {
        if (!event.currentTarget.matches(":focus-visible") || !needsHint(event.currentTarget)) event.preventDefault();
      }}>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className="ui-tooltip" side={side} sideOffset={8} collisionPadding={10} hideWhenDetached>
          {label}
          <Primitive.Arrow className="ui-tooltip__arrow" width={8} height={4} />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  </Primitive.Provider>;
}
