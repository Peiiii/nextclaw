import type { ChatMessagePartViewModel } from "../../../view-models/chat-ui.types";

export type ChatMessageFileView = Extract<
  ChatMessagePartViewModel,
  { type: "file" }
>["file"];

export type FileCategory =
  | "archive"
  | "audio"
  | "code"
  | "data"
  | "document"
  | "generic"
  | "image"
  | "pdf"
  | "sheet"
  | "video";

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  archive: "Archive",
  audio: "Audio",
  code: "Code",
  data: "Data",
  document: "Document",
  generic: "File",
  image: "Image",
  pdf: "PDF",
  sheet: "Sheet",
  video: "Video",
};

export const FILE_CATEGORY_TILE_CLASSES: Record<FileCategory, string> = {
  archive: "border-amber-200/80 bg-amber-100 text-amber-700",
  audio: "border-fuchsia-200/80 bg-fuchsia-100 text-fuchsia-700",
  code: "border-cyan-200/80 bg-cyan-100 text-cyan-700",
  data: "border-slate-200/80 bg-slate-100 text-slate-700",
  document: "border-blue-200/80 bg-blue-100 text-blue-700",
  generic: "border-slate-200/80 bg-slate-100 text-slate-700",
  image: "border-emerald-200/80 bg-emerald-100 text-emerald-700",
  pdf: "border-rose-200/80 bg-rose-100 text-rose-700",
  sheet: "border-lime-200/80 bg-lime-100 text-lime-700",
  video: "border-violet-200/80 bg-violet-100 text-violet-700",
};

const CODE_EXTENSIONS = new Set([
  "c",
  "cpp",
  "css",
  "go",
  "html",
  "java",
  "js",
  "jsx",
  "md",
  "php",
  "py",
  "rb",
  "rs",
  "sh",
  "sql",
  "svg",
  "ts",
  "tsx",
]);

const DATA_EXTENSIONS = new Set([
  "graphql",
  "json",
  "toml",
  "xml",
  "yaml",
  "yml",
]);
const DOCUMENT_EXTENSIONS = new Set([
  "doc",
  "docx",
  "odt",
  "pages",
  "rtf",
  "txt",
]);
const SHEET_EXTENSIONS = new Set([
  "csv",
  "numbers",
  "ods",
  "tsv",
  "xls",
  "xlsx",
]);
const ARCHIVE_EXTENSIONS = new Set([
  "7z",
  "bz2",
  "gz",
  "rar",
  "tar",
  "tgz",
  "zip",
]);

function formatFileSize(sizeBytes?: number): string | null {
  if (!Number.isFinite(sizeBytes) || sizeBytes == null || sizeBytes < 0) {
    return null;
  }
  if (sizeBytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = sizeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits).replace(/\.0$/, "")} ${units[unitIndex]}`;
}

function getFileExtension(label: string, mimeType: string): string {
  const match = /\.([a-z0-9]{1,12})$/i.exec(label.trim());
  if (match?.[1]) {
    return match[1].toUpperCase();
  }
  const subtype = mimeType.split("/")[1] ?? "";
  const cleaned = subtype.split(/[+.;-]/)[0]?.trim();
  if (!cleaned) {
    return "FILE";
  }
  return cleaned.slice(0, 6).toUpperCase();
}

function resolveFileCategory(label: string, mimeType: string): FileCategory {
  const extension =
    /\.([a-z0-9]{1,12})$/i.exec(label.trim())?.[1]?.toLowerCase() ?? "";
  const normalizedMimeType = mimeType.toLowerCase();

  if (normalizedMimeType.startsWith("image/")) {
    return "image";
  }
  if (normalizedMimeType.startsWith("audio/")) {
    return "audio";
  }
  if (normalizedMimeType.startsWith("video/")) {
    return "video";
  }
  if (normalizedMimeType.includes("pdf") || extension === "pdf") {
    return "pdf";
  }
  if (
    ARCHIVE_EXTENSIONS.has(extension) ||
    /(zip|tar|gzip|rar|compressed|archive)/.test(normalizedMimeType)
  ) {
    return "archive";
  }
  if (
    SHEET_EXTENSIONS.has(extension) ||
    /(spreadsheet|sheet|excel|csv)/.test(normalizedMimeType)
  ) {
    return "sheet";
  }
  if (
    DATA_EXTENSIONS.has(extension) ||
    /(json|xml|yaml|toml)/.test(normalizedMimeType)
  ) {
    return "data";
  }
  if (
    CODE_EXTENSIONS.has(extension) ||
    /(javascript|typescript|jsx|tsx|css|html)/.test(normalizedMimeType)
  ) {
    return "code";
  }
  if (
    DOCUMENT_EXTENSIONS.has(extension) ||
    /(msword|document|opendocument|rtf|text\/)/.test(normalizedMimeType)
  ) {
    return "document";
  }
  return "generic";
}

export function buildChatMessageFileMeta(file: ChatMessageFileView): {
  category: FileCategory;
  extension: string;
  sizeLabel: string | null;
  metaBadges: string[];
} {
  const category = resolveFileCategory(file.label, file.mimeType);
  const sizeLabel = formatFileSize(file.sizeBytes);
  return {
    category,
    extension: getFileExtension(file.label, file.mimeType),
    sizeLabel,
    metaBadges: [FILE_CATEGORY_LABELS[category], sizeLabel].filter(
      (value): value is string => Boolean(value),
    ),
  };
}
