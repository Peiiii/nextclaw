import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Expand, X } from "lucide-react";

function ChatMessageImageLightbox({
  alt,
  closeLabel,
  onClose,
  src,
}: {
  alt: string;
  closeLabel: string;
  onClose: () => void;
  src: string;
}) {
  const titleId = useId();

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
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[var(--z-modal,10050)] flex items-center justify-center bg-black/80 p-4 backdrop-blur-[2px]"
      data-testid="chat-message-image-lightbox"
      onClick={onClose}
    >
      <span id={titleId} className="sr-only">
        {alt}
      </span>
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
      <img
        src={src}
        alt={alt}
        className="max-h-[min(92vh,100%)] max-w-[min(96vw,100%)] object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
export function ChatMessageImagePreview({
  alt,
  expandLabel,
  closeLabel,
  sizeLabel,
  src,
}: {
  alt: string;
  expandLabel: string;
  closeLabel: string;
  sizeLabel: string | null;
  src: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const openLightbox = () => setIsExpanded(true);

  return (
    <>
      <span
        data-chat-message-image-preview
        className="group/image relative block w-fit max-w-[min(100%,32rem)] overflow-hidden rounded-lg"
      >
        <button
          type="button"
          className="block w-fit max-w-[min(100%,32rem)] text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
          onClick={openLightbox}
          onDoubleClick={(event) => {
            event.preventDefault();
            openLightbox();
          }}
          aria-label={expandLabel}
        >
          <img
            src={src}
            alt={alt}
            className="block h-auto w-auto max-h-[26rem] max-w-full rounded-lg bg-transparent object-contain"
          />
        </button>
        <button
          type="button"
          aria-label={expandLabel}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/45 text-white opacity-0 transition-opacity duration-150 hover:bg-black/60 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/70 group-hover/image:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openLightbox();
          }}
        >
          <Expand className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        {sizeLabel ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-start bg-gradient-to-t from-black/50 via-black/15 to-transparent px-2.5 pb-2 pt-8 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100 group-focus-within/image:opacity-100">
            <span className="inline-flex items-center rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm">
              {sizeLabel}
            </span>
          </span>
        ) : null}
      </span>
      {isExpanded ? (
        <ChatMessageImageLightbox
          alt={alt}
          closeLabel={closeLabel}
          onClose={() => setIsExpanded(false)}
          src={src}
        />
      ) : null}
    </>
  );
}
