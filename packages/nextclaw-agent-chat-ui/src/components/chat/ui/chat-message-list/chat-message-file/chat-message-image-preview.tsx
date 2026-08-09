import { useState } from "react";
import { Expand } from "lucide-react";
import {
  ChatMessageLightbox,
  ChatMessagePreviewToolbar,
} from "@agent-chat-ui/components/chat/ui/chat-message-lightbox";

export function ChatMessageImagePreview({
  alt,
  expandLabel,
  closeLabel,
  resetZoomLabel,
  sizeLabel,
  src,
  zoomInLabel,
  zoomOutLabel,
}: {
  alt: string;
  expandLabel: string;
  closeLabel: string;
  resetZoomLabel?: string;
  sizeLabel: string | null;
  src: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
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
        <ChatMessagePreviewToolbar
          actions={[
            {
              id: "expand",
              label: expandLabel,
              icon: <Expand className="h-4 w-4" strokeWidth={2} />,
              onSelect: openLightbox,
            },
          ]}
        />
        {sizeLabel ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-start bg-gradient-to-t from-black/50 via-black/15 to-transparent px-2.5 pb-2 pt-8 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100 group-focus-within/image:opacity-100">
            <span className="inline-flex items-center rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm">
              {sizeLabel}
            </span>
          </span>
        ) : null}
      </span>
      {isExpanded ? (
        <ChatMessageLightbox
          closeLabel={closeLabel}
          label={alt}
          onClose={() => setIsExpanded(false)}
          resetZoomLabel={resetZoomLabel}
          zoomInLabel={zoomInLabel}
          zoomOutLabel={zoomOutLabel}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain shadow-2xl"
          />
        </ChatMessageLightbox>
      ) : null}
    </>
  );
}
