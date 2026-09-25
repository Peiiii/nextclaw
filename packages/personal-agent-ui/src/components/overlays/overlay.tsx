import { useRef, type ReactNode, type RefObject } from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IconButton } from "../icon-button";

type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  busy?: boolean;
  children: ReactNode;
  returnFocusRef?: RefObject<HTMLElement>;
  initialFocusRef?: RefObject<HTMLElement>;
};

function Overlay({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  busy = false,
  children,
  returnFocusRef,
  initialFocusRef,
  variant,
}: OverlayProps & { variant: "dialog" | "sheet" }) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  return (
    <Primitive.Root
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <Primitive.Portal>
        <Primitive.Overlay className="ui-overlay-backdrop" />
        <Primitive.Content
          ref={content}
          tabIndex={-1}
          className={`ui-overlay ui-overlay--${variant}`}
          {...(!description ? { "aria-describedby": undefined } : {})}
          aria-busy={busy}
          onOpenAutoFocus={(event) => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            const input = initialFocusRef?.current ?? content.current?.querySelector<HTMLElement>(
              "input:not([disabled]), textarea:not([disabled]), select:not([disabled])"
            );
            if (input) {
              event.preventDefault();
              input.focus();
            } else {
              event.preventDefault();
              content.current?.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef?.current ?? previousFocus.current;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <header className="ui-overlay__header">
            <div>
              <Primitive.Title className="ui-overlay__title">
                {title}
              </Primitive.Title>
              {description && (
                <Primitive.Description className="ui-overlay__description">
                  {description}
                </Primitive.Description>
              )}
            </div>
            <Primitive.Close asChild>
              <IconButton disabled={busy} label={closeLabel} icon={<X />} tooltip={false} />
            </Primitive.Close>
          </header>
          <div className="ui-overlay__body">{children}</div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

export function Dialog(props: OverlayProps) {
  return <Overlay {...props} variant="dialog" />;
}
export function Sheet(props: OverlayProps) {
  return <Overlay {...props} variant="sheet" />;
}
