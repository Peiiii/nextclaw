import { cn } from "../../../internal/cn";
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
import type { ChatMessageTexts } from "../../../view-models/chat-ui.types";

type ChatMessageFileProps = {
  file: ChatMessageFileView;
  isUser?: boolean;
  texts?: Pick<
    ChatMessageTexts,
    "attachmentOpenLabel" | "attachmentAttachedLabel" | "attachmentCategoryLabels"
  >;
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
        "mt-1 text-xs leading-5",
        isUser ? "text-white/70" : "text-slate-500",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        isInteractive
          ? isUser
            ? "border-white/14 bg-white/12 text-white"
            : "border-slate-200/80 bg-white text-slate-700"
          : isUser
            ? "border-white/10 bg-white/6 text-white/62"
            : "border-slate-200/70 bg-slate-100/80 text-slate-500",
      )}
    >
      {label}
    </span>
  );
}

function renderActionLink(
  label: string,
  href: string,
  isUser: boolean,
) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition duration-200",
        isUser
          ? "border-white/14 bg-white/12 text-white hover:border-white/20 hover:bg-white/16"
          : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
      )}
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
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] border",
        isUser
          ? "border-white/12 bg-white/10 text-white"
          : FILE_CATEGORY_TILE_CLASSES[category],
      )}
    >
      <Icon
        className={cn(
          "h-7 w-7",
          isUser ? "text-white/92" : "text-current",
        )}
        strokeWidth={2.2}
      />
    </div>
  );
}

function renderImagePreview(params: {
  file: ChatMessageFileView;
  categoryLabel: string;
  sizeLabel: string | null;
  isUser: boolean;
}) {
  const { file, categoryLabel, sizeLabel, isUser } = params;
  if (!file.dataUrl) {
    return null;
  }
  return (
    <a
      href={file.dataUrl}
      target="_blank"
      rel="noreferrer"
      className="group block"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[1rem]",
          isUser
            ? "ring-1 ring-white/10"
            : "bg-slate-100/80 ring-1 ring-slate-200/80",
        )}
      >
        <img
          src={file.dataUrl}
          alt={file.label}
          className="block h-auto max-h-[26rem] w-full rounded-[1rem] bg-transparent object-contain transition duration-300 group-hover:scale-[1.01]"
        />
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.18em] text-white backdrop-blur-sm",
              isUser ? "bg-slate-950/36" : "bg-slate-950/58",
            )}
          >
            {categoryLabel}
          </span>
          {sizeLabel ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium text-white/92 backdrop-blur-sm",
                isUser ? "bg-slate-950/28" : "bg-slate-950/46",
              )}
            >
              {sizeLabel}
            </span>
          ) : null}
        </div>
      </div>
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
    <div className="flex items-center gap-3 p-3.5">
      <FileCategoryGlyph
        category={category}
        isUser={isUser}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-5">
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
}) {
  const { category, file, categoryLabel, sizeLabel, isUser, shellClasses, actionLabel } = params;
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
        action: renderActionLink(actionLabel, file.dataUrl, isUser),
      })}
      <div className="px-3.5 pb-3.5">
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
              "overflow-hidden rounded-[1rem] border",
              isUser
                ? "border-white/10 bg-slate-950/26"
                : "border-slate-200/80 bg-slate-100/80",
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
    "block overflow-hidden rounded-[1.25rem] border transition duration-200",
    isUser
      ? "border-white/12 bg-white/10 text-white"
      : "border-slate-200/80 bg-white/95 text-slate-900",
    isInteractive &&
      (isUser
        ? "hover:border-white/18 hover:bg-white/13"
        : "hover:border-slate-300 hover:bg-white"),
  );

  if (renderAsImage) {
    return renderImagePreview({ file, categoryLabel, sizeLabel, isUser });
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
