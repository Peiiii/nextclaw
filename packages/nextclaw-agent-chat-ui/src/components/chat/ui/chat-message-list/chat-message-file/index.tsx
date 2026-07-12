import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import {
  File,
  FileArchive,
  FileAudio2,
  FileCode2,
  FileImage,
  FileJson2,
  FileSpreadsheet,
  FileText,
  FileVideo2,
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
    "attachmentOpenLabel" | "attachmentAttachedLabel" | "attachmentCategoryLabels"
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

function renderImagePreview(params: {
  file: ChatMessageFileView;
  categoryLabel: string;
  sizeLabel: string | null;
  isUser: boolean;
  onOpen?: (file: ChatMessageFileView) => void;
  openLabel: string;
}) {
  const { file, sizeLabel, onOpen, openLabel } = params;
  if (!file.dataUrl) {
    return null;
  }

  const content = (
    <div className="group/image relative overflow-hidden rounded-xl">
      <img
        src={file.dataUrl}
        alt={file.label}
        className="block h-auto max-h-[26rem] w-full rounded-xl bg-transparent object-contain"
      />
      {(sizeLabel || onOpen) ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/55 via-black/20 to-transparent px-2.5 pb-2 pt-8 opacity-0 transition-opacity duration-150 group-hover/image:opacity-100 group-focus-within/image:opacity-100">
          {sizeLabel ? (
            <span className="inline-flex items-center rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm">
              {sizeLabel}
            </span>
          ) : (
            <span />
          )}
          {onOpen ? (
            <span className="inline-flex items-center rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm">
              {openLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        className="group block w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
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
      className="group block"
    >
      {content}
    </a>
  );
}

function renderFileCardHeader(params: {
  category: FileCategory;
  file: ChatMessageFileView;
  categoryLabel: string;
  sizeLabel: string | null;
  isUser: boolean;
  action: React.ReactNode;
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
    return renderImagePreview({
      file,
      categoryLabel,
      sizeLabel,
      isUser,
      onOpen,
      openLabel: actionLabel,
    });
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
