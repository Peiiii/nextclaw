import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "./icon-button";

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  initialFocusSelector?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, title, description, initialFocusSelector, onClose, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (initialFocusSelector) {
        const initialFocus = dialog.querySelector<HTMLElement>(initialFocusSelector);
        initialFocus?.focus();
      }
    }
    if (!open && dialog.open) dialog.close();
  }, [initialFocusSelector, open]);

  return (
    <dialog
      ref={dialogRef}
      className="panel-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="panel-dialog-scroll">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-semibold tracking-[-0.02em]">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{description}</p> : null}
          </div>
          <IconButton label="关闭" onClick={onClose}><X size={17} /></IconButton>
        </header>
        {children}
      </div>
    </dialog>
  );
}
