import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { PopoverContent } from "@/shared/components/ui/popover";

function isChatComposerFocusTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest('.nextclaw-chat-input-bar-shell [role="textbox"][contenteditable="true"]'),
  );
}

export const ChatPopoverContent = forwardRef<
  ElementRef<typeof PopoverContent>,
  ComponentPropsWithoutRef<typeof PopoverContent>
>(function ChatPopoverContent({ onFocusOutside, ...props }, ref) {
  return (
    <PopoverContent
      {...props}
      ref={ref}
      onFocusOutside={(event) => {
        onFocusOutside?.(event);
        if (!event.defaultPrevented && isChatComposerFocusTarget(event.detail.originalEvent.target)) {
          event.preventDefault();
        }
      }}
    />
  );
});
