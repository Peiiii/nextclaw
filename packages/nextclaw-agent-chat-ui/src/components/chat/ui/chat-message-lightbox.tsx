import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function ChatMessageLightbox({
  children,
  closeLabel,
  label,
  onClose,
}: {
  children: ReactNode;
  closeLabel: string;
  label: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-label={label}
      aria-modal="true"
      className="fixed inset-0 z-[var(--z-modal,10050)] flex items-center justify-center bg-black/80 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
      <div onClick={(event) => event.stopPropagation()}>{children}</div>
    </div>,
    document.body,
  );
}
