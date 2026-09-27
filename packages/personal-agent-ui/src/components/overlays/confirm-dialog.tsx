import { useRef, type RefObject } from "react";
import { Button } from "../button";
import { Dialog } from "./overlay";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  returnFocusRef?: RefObject<HTMLElement>;
};

/** Controlled confirmation; the caller owns the operation and its result. */
export function ConfirmDialog({
  open, onOpenChange, title, description, cancelLabel, confirmLabel,
  busyLabel, busy = false, error, onConfirm, returnFocusRef,
}: ConfirmDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  return <Dialog open={open} onOpenChange={onOpenChange} title={title}
    description={description} closeLabel={cancelLabel} busy={busy} returnFocusRef={returnFocusRef} initialFocusRef={cancel}>
    {error && <p className="ui-overlay__error" role="alert">{error}</p>}
    <div className="ui-overlay__actions">
      <Button ref={cancel} disabled={busy} onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
      <Button tone="danger" disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</Button>
    </div>
  </Dialog>;
}
