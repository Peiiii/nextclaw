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

function readFileCategoryIcon(category: FileCategory) {
  if (category === "archive") {
    return FileArchive;
  }
  if (category === "audio") {
    return FileAudio2;
  }
  if (category === "code") {
    return FileCode2;
  }
  if (category === "data") {
    return FileJson2;
  }
  if (category === "pdf") {
    return FileText;
  }
  if (category === "sheet") {
    return FileSpreadsheet;
  }
  if (category === "image") {
    return FileImage;
  }
  if (category === "video") {
    return FileVideo2;
  }
  if (category === "document") {
    return FileText;
  }
  return File;
}

function FileCategoryGlyph({
  category,
  isUser,
}: {
  category: FileCategory;
  isUser: boolean;
}) {
  const Icon = readFileCategoryIcon(category);

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

export function ChatMessageFile({
  file,
  isUser = false,
  texts,
}: ChatMessageFileProps) {
  const { category, extension, sizeLabel } = buildChatMessageFileMeta(file);
  const renderAsImage = isImageFileLike(file) && Boolean(file.dataUrl);
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

  if (renderAsImage && file.dataUrl) {
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

  const content = (
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
          {renderActionPill(actionLabel, isUser, isInteractive)}
        </div>
      </div>
    </div>
  );

  if (!isInteractive) {
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
