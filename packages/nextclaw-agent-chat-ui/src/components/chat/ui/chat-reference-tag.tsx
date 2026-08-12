import type { ReactElement } from "react";
import {
  AppWindow,
  Blocks,
  BookOpenText,
  File,
  FileArchive,
  FileAudio2,
  FileCode2,
  FileImage,
  FileJson2,
  FileSpreadsheet,
  FileText,
  FileVideo2,
  Folder,
  FolderKanban,
  Globe2,
  Link2,
  MessageSquareQuote,
  Sparkles,
  TextQuote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import { ChatUiPrimitives } from "@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives";

export const CHAT_REFERENCE_TAG_CLASS_NAME = [
  "mx-[2px]",
  "inline-flex",
  "h-6",
  "max-w-full",
  "items-center",
  "gap-1.5",
  "rounded-[7px]",
  "border",
  "border-border/70",
  "bg-background/80",
  "px-1.5",
  "align-middle",
  "text-[11px]",
  "font-medium",
  "leading-none",
  "text-foreground",
].join(" ");

const CODE_EXTENSIONS = new Set([
  "c", "cpp", "css", "go", "html", "java", "js", "jsx", "md", "php", "py", "rb",
  "rs", "sh", "sql", "svelte", "swift", "ts", "tsx", "vue",
]);
const DATA_EXTENSIONS = new Set(["graphql", "json", "toml", "xml", "yaml", "yml"]);
const IMAGE_EXTENSIONS = new Set([
  "avif", "bmp", "gif", "heic", "heif", "ico", "jpeg", "jpg", "png", "svg", "tif",
  "tiff", "webp",
]);
const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "ogg", "opus", "wav", "weba"]);
const VIDEO_EXTENSIONS = new Set(["avi", "m4v", "mkv", "mov", "mp4", "webm", "wmv"]);
const SHEET_EXTENSIONS = new Set(["csv", "numbers", "ods", "tsv", "xls", "xlsx"]);
const ARCHIVE_EXTENSIONS = new Set(["7z", "bz2", "gz", "rar", "tar", "tgz", "zip"]);
const DOCUMENT_EXTENSIONS = new Set(["doc", "docx", "odt", "pages", "pdf", "rtf", "txt"]);

type ChatReferenceTagContentProps = {
  excerpt?: string | null;
  kind: string;
  label: string;
  metricLabel?: string | null;
  source?: string | null;
};

type ChatReferenceTagPreviewProps = {
  characterCountLabel?: string | null;
  children: ReactElement;
  excerpt: string;
  kind?: string;
  label: string;
  location?: string | null;
  path?: string | null;
};

type ChatReferenceIconDescriptor = {
  icon: LucideIcon;
  name: string;
};

function readFileExtension(value: string): string {
  return /\.([a-z0-9]{1,16})$/i.exec(value.trim())?.[1]?.toLowerCase() ?? "";
}

function resolveFileIconDescriptor(value: string): ChatReferenceIconDescriptor {
  const extension = readFileExtension(value);
  if (DATA_EXTENSIONS.has(extension)) {
    return { icon: FileJson2, name: "data-file" };
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return { icon: FileImage, name: "image-file" };
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return { icon: FileAudio2, name: "audio-file" };
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return { icon: FileVideo2, name: "video-file" };
  }
  if (SHEET_EXTENSIONS.has(extension)) {
    return { icon: FileSpreadsheet, name: "sheet-file" };
  }
  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return { icon: FileArchive, name: "archive-file" };
  }
  if (CODE_EXTENSIONS.has(extension)) {
    return { icon: FileCode2, name: "code-file" };
  }
  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return { icon: FileText, name: "document-file" };
  }
  return { icon: File, name: "file" };
}

function resolveReferenceIconDescriptor(kind: string, source: string): ChatReferenceIconDescriptor {
  if (kind === "skill") {
    return { icon: Sparkles, name: "skill" };
  }
  if (kind === "panel_app") {
    return { icon: AppWindow, name: "panel-app" };
  }
  if (kind === "ui_resource") {
    if (source.startsWith("nextclaw://panel-app")) {
      return { icon: AppWindow, name: "panel-app" };
    }
    if (source.startsWith("nextclaw://docs")) {
      return { icon: BookOpenText, name: "docs" };
    }
    if (source.startsWith("nextclaw://apps")) {
      return { icon: Blocks, name: "apps" };
    }
    return { icon: Globe2, name: "web-resource" };
  }
  if (kind === "project") {
    return { icon: FolderKanban, name: "project" };
  }
  if (kind === "workspace_directory") {
    return { icon: Folder, name: "directory" };
  }
  if (kind === "workspace_excerpt") {
    return { icon: TextQuote, name: "excerpt" };
  }
  if (kind === "conversation_excerpt") {
    return { icon: MessageSquareQuote, name: "conversation-excerpt" };
  }
  if (kind === "workspace_file" || kind === "file") {
    return resolveFileIconDescriptor(source);
  }
  return { icon: Link2, name: "reference" };
}

export function ChatReferenceIcon({
  className,
  kind,
  source,
}: {
  className?: string;
  kind: string;
  source?: string | null;
}) {
  const descriptor = resolveReferenceIconDescriptor(kind, source ?? "");
  const Icon = descriptor.icon;
  return (
    <Icon
      aria-hidden="true"
      className={cn("h-3 w-3", className)}
      data-reference-icon={descriptor.name}
    />
  );
}

export function countChatReferenceCharacters(value: string): number {
  return Array.from(value).length;
}

export function resolveWorkspaceExcerptTagMetric(params: {
  characterCountTemplate?: string;
  endLine?: number | null;
  excerpt: string;
  startLine?: number | null;
}) {
  const { characterCountTemplate, endLine, excerpt, startLine } = params;
  const location = startLine
    ? startLine === endLine || !endLine
      ? `L${startLine}`
      : `L${startLine}–${endLine}`
    : null;
  const characterCountLabel = characterCountTemplate?.replace(
    "{count}",
    String(countChatReferenceCharacters(excerpt)),
  );
  return {
    characterCountLabel,
    location,
    metricLabel: location ?? characterCountLabel,
  };
}

export function ChatReferenceTagContent({
  excerpt,
  kind,
  label,
  metricLabel,
  source,
}: ChatReferenceTagContentProps) {
  const normalizedExcerpt = excerpt?.replace(/\s+/g, " ").trim() ?? "";
  const excerptCharacters = Array.from(normalizedExcerpt);
  const summary = excerptCharacters.length > 64
    ? `${excerptCharacters.slice(0, 64).join("").trimEnd()}…`
    : normalizedExcerpt;
  return (
    <>
      <span
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground"
        data-reference-kind={kind}
      >
        <ChatReferenceIcon kind={kind} source={source ?? label} />
      </span>
      <span className={excerpt ? "max-w-[10rem] shrink truncate" : "max-w-[16rem] truncate"}>
        {label}
      </span>
      {metricLabel ? (
        <span className="shrink-0 text-[10px] font-normal text-muted-foreground">
          {metricLabel}
        </span>
      ) : null}
      {summary ? (
        <>
          <span aria-hidden="true" className="shrink-0 text-muted-foreground/60">·</span>
          <span className="min-w-[3rem] max-w-[14rem] truncate font-normal text-foreground/70">
            {summary}
          </span>
        </>
      ) : null}
    </>
  );
}

export function ChatReferenceTagPreview({
  children,
  characterCountLabel,
  excerpt,
  kind = "workspace_file",
  label,
  location,
  path,
}: ChatReferenceTagPreviewProps) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          collisionPadding={12}
          className="w-fit min-w-[min(14rem,calc(100vw-1.5rem))] max-w-[min(28rem,calc(100vw-1.5rem))] p-0 text-left"
        >
          <span className="flex min-w-0 items-center gap-2 border-b border-border/70 px-3 py-2">
            <ChatReferenceIcon
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              kind={kind}
              source={path ?? label}
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {path || label}
            </span>
            {location ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {location}
              </span>
            ) : null}
            {characterCountLabel ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {characterCountLabel}
              </span>
            ) : null}
          </span>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[11px] font-normal leading-5 text-popover-foreground">
            {excerpt}
          </pre>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
