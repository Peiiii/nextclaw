import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import {
  Expand,
  File,
  FileArchive,
  FileAudio2,
  FileCode2,
  FileImage,
  FileJson2,
  FileSpreadsheet,
  FileText,
  FileVideo2,
  X,
} from "lucide-react";
import {
  buildChatMessageFileMeta,
  FILE_CATEGORY_TILE_CLASSES,
  isImageFileLike,
  resolveRenderableMimeType,
  type FileCategory,
  type ChatMessageFileView,
} from "./meta";
import type { ChatMessageTexts } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

type ChatMessageFileProps = {
  file: ChatMessageFileView;
  isUser?: boolean;
  texts?: Pick<
    ChatMessageTexts,
    | "attachmentOpenLabel"
    | "attachmentAttachedLabel"
    | "attachmentExpandLabel"
    | "attachmentCloseLabel"
    | "attachmentCategoryLabels"
  >;
  onOpen?: (file: ChatMessageFileView) => void;
};

const DEFAULT_FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  archive: "Archive",
  audio: "Audio",
  code: "Code file",
  data: "Data file",
  document: "Document",
  generic: "File",
  image: "Image",
  pdf: "PDF document",
  sheet: "Spreadsheet",
  video: "Video",
};

const FILE_CATEGORY_ICONS: Record<FileCategory, typeof File> = {
  archive: FileArchive,
  audio: FileAudio2,
  code: FileCode2,
  data: FileJson2,
  document: FileText,
  generic: File,
  image: FileImage,
  pdf: FileText,
  sheet: FileSpreadsheet,
  video: FileVideo2,
};

function readFileCategoryLabel(
  category: FileCategory,
  texts?: ChatMessageFileProps["texts"],
): string {
  return (
    texts?.attachmentCategoryLabels?.[category] ??
    DEFAULT_FILE_CATEGORY_LABELS[category]
  );
}

function renderMetaLine(
  categoryLabel: string,
  sizeLabel: string | null,
  isUser: boolean,
) {
  return (
    <div
      className={cn(
        "mt-0.5 text-[11px] leading-4",
        isUser ? "text-foreground/55" : "text-muted-foreground",
      )}
    >
      {sizeLabel ? `${categoryLabel} · ${sizeLabel}` : categoryLabel}
    </div>
  );
}

function renderActionPill(
  label: string,
  isUser: boolean,
  isInteractive: boolean,
) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        isInteractive
          ? isUser
            ? "bg-black/5 text-foreground/75"
            : "bg-muted text-muted-foreground"
          : isUser
            ? "bg-black/[0.03] text-foreground/45"
            : "bg-muted/70 text-muted-foreground/70",
      )}
    >
      {label}
    </span>
  );
}

function renderActionControl(params: {
  label: string;
  href?: string;
  isUser: boolean;
  onOpen?: () => void;
}) {
  const { label, href, isUser, onOpen } = params;
  const className = cn(
    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
    isUser
      ? "bg-black/5 text-foreground/75 hover:bg-black/10 hover:text-foreground"
      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
  );

  if (onOpen) {
    return (
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpen();
        }}
      >
        {label}
      </button>
    );
  }

  if (!href) {
    return renderActionPill(label, isUser, false);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {label}
    </a>
  );
}

function FileCategoryGlyph({
  category,
  isUser,
}: {
  category: FileCategory;
  isUser: boolean;
}) {
  const Icon = FILE_CATEGORY_ICONS[category];

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        isUser
          ? "bg-black/5 text-foreground/70"
          : FILE_CATEGORY_TILE_CLASSES[category],
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4",
          isUser ? "text-foreground/70" : "text-current",
        )}
        strokeWidth={2}
      />
    </div>
  );
}

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

function ChatMessageImagePreview({
  expandLabel,
  closeLabel,
  file,
  sizeLabel,
}: {
  expandLabel: string;
  closeLabel: string;
  file: ChatMessageFileView;
  sizeLabel: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!file.dataUrl) {
    return null;
  }

  const openLightbox = () => setIsExpanded(true);

  return (
    <>
      <div className="group/image relative w-fit max-w-full overflow-hidden rounded-xl">
        <button
          type="button"
          className="block w-fit max-w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
          onClick={openLightbox}
          onDoubleClick={(event) => {
            event.preventDefault();
            openLightbox();
          }}
          aria-label={expandLabel}
        >
          <img
            src={file.dataUrl}
            alt={file.label}
            className="block h-auto max-h-[26rem] max-w-full rounded-xl bg-transparent object-contain"
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-start bg-gradient-to-t from-black/50 via-black/15 to-transparent px-2.5 pb-2 pt-8 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100 group-focus-within/image:opacity-100">
            <span className="inline-flex items-center rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm">
              {sizeLabel}
            </span>
          </div>
        ) : null}
      </div>
      {isExpanded ? (
        <ChatMessageImageLightbox
          alt={file.label}
          closeLabel={closeLabel}
          onClose={() => setIsExpanded(false)}
          src={file.dataUrl}
        />
      ) : null}
    </>
  );
}

function renderFileCardHeader(params: {
  category: FileCategory;
  file: ChatMessageFileView;
  categoryLabel: string;
  sizeLabel: string | null;
  isUser: boolean;
  action: ReactNode;
}) {
  const { category, file, categoryLabel, sizeLabel, isUser, action } = params;
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2">
      <FileCategoryGlyph
        category={category}
        isUser={isUser}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium leading-5">
              {file.label}
            </div>
            {renderMetaLine(categoryLabel, sizeLabel, isUser)}
          </div>
          {action}
        </div>
      </div>
    </div>
  );
}

function renderInlineMediaCard(params: {
  category: FileCategory;
  file: ChatMessageFileView;
  categoryLabel: string;
  sizeLabel: string | null;
  isUser: boolean;
  shellClasses: string;
  actionLabel: string;
  onOpen?: (file: ChatMessageFileView) => void;
}) {
  const {
    category,
    file,
    categoryLabel,
    sizeLabel,
    isUser,
    shellClasses,
    actionLabel,
    onOpen,
  } = params;
  if (!file.dataUrl || (category !== "audio" && category !== "video")) {
    return null;
  }
  const mediaMimeType = resolveRenderableMimeType(file);
  return (
    <div className={shellClasses}>
      {renderFileCardHeader({
        category,
        file,
        categoryLabel,
        sizeLabel,
        isUser,
        action: renderActionControl({
          label: actionLabel,
          href: file.dataUrl,
          isUser,
          onOpen: onOpen ? () => onOpen(file) : undefined,
        }),
      })}
      <div className="px-2.5 pb-2.5">
        {category === "audio" ? (
          <audio
            controls
            preload="metadata"
            aria-label={file.label}
            className="block w-full"
          >
            <source
              src={file.dataUrl}
              {...(mediaMimeType ? { type: mediaMimeType } : {})}
            />
          </audio>
        ) : (
          <div
            className={cn(
              "overflow-hidden rounded-lg",
              isUser
                ? "bg-black/10"
                : "bg-muted ring-1 ring-border/70",
            )}
          >
            <video
              controls
              preload="metadata"
              playsInline
              aria-label={file.label}
              className="block max-h-[28rem] w-full bg-black"
            >
              <source
                src={file.dataUrl}
                {...(mediaMimeType ? { type: mediaMimeType } : {})}
              />
            </video>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatMessageFile({
  file,
  isUser = false,
  texts,
  onOpen,
}: ChatMessageFileProps) {
  const { category, sizeLabel } = buildChatMessageFileMeta(file);
  const renderAsImage = isImageFileLike(file) && Boolean(file.dataUrl);
  const renderAsAudio = category === "audio" && Boolean(file.dataUrl);
  const renderAsVideo = category === "video" && Boolean(file.dataUrl);
  const isInteractive = Boolean(file.dataUrl);
  const actionLabel = isInteractive
    ? texts?.attachmentOpenLabel ?? "Open"
    : texts?.attachmentAttachedLabel ?? "Attached";
  const expandLabel = texts?.attachmentExpandLabel ?? "Expand image";
  const closeLabel = texts?.attachmentCloseLabel ?? "Close preview";
  const categoryLabel = readFileCategoryLabel(category, texts);
  const shellClasses = cn(
    "block overflow-hidden rounded-xl border transition-colors",
    isUser
      ? "border-black/8 bg-black/[0.03] text-foreground"
      : "border-border/70 bg-card text-card-foreground",
    isInteractive &&
      (isUser
        ? "hover:bg-black/[0.05]"
        : "hover:bg-muted/50"),
  );

  if (renderAsImage) {
    return (
      <ChatMessageImagePreview
        expandLabel={expandLabel}
        closeLabel={closeLabel}
        file={file}
        sizeLabel={sizeLabel}
      />
    );
  }

  if (renderAsAudio || renderAsVideo) {
    return renderInlineMediaCard({
      category,
      file,
      categoryLabel,
      sizeLabel,
      isUser,
      shellClasses,
      actionLabel,
      onOpen,
    });
  }

  const content = renderFileCardHeader({
    category,
    file,
    categoryLabel,
    sizeLabel,
    isUser,
    action: renderActionPill(actionLabel, isUser, isInteractive),
  });

  if (!isInteractive || !file.dataUrl) {
    return <div className={shellClasses}>{content}</div>;
  }

  if (onOpen) {
    return (
      <button
        type="button"
        className={cn(shellClasses, "group w-full text-left")}
        onClick={() => onOpen(file)}
      >
        {content}
      </button>
    );
  }

  return (
    <a
      href={file.dataUrl}
      target="_blank"
      rel="noreferrer"
      className={cn(shellClasses, "group")}
    >
      {content}
    </a>
  );
}
