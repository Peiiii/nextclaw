import type {
  ChatAttachmentCategory,
  ChatMessagePartViewModel,
} from "../../../view-models/chat-ui.types";

export type ChatMessageFileView = Extract<
  ChatMessagePartViewModel,
  { type: "file" }
>["file"];

export type FileCategory = ChatAttachmentCategory;

export const FILE_CATEGORY_TILE_CLASSES: Record<FileCategory, string> = {
  archive: "border-amber-200/80 bg-amber-50 text-amber-700",
  audio: "border-fuchsia-200/80 bg-fuchsia-50 text-fuchsia-700",
  code: "border-cyan-200/80 bg-cyan-50 text-cyan-700",
  data: "border-slate-200/80 bg-slate-50 text-slate-700",
  document: "border-blue-200/80 bg-blue-50 text-blue-700",
  generic: "border-slate-200/80 bg-slate-50 text-slate-700",
  image: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
  pdf: "border-rose-200/80 bg-rose-50 text-rose-700",
  sheet: "border-lime-200/80 bg-lime-50 text-lime-700",
  video: "border-violet-200/80 bg-violet-50 text-violet-700",
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
const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp",
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
  const extension = readFileExtension(label);
  if (extension) {
    return extension.toUpperCase();
  }
  const subtype = mimeType.split("/")[1] ?? "";
  const cleaned = subtype.split(/[+.;-]/)[0]?.trim();
  if (!cleaned) {
    return "FILE";
  }
  return cleaned.slice(0, 6).toUpperCase();
}

function readFileExtension(label: string): string {
  return /\.([a-z0-9]{1,12})$/i.exec(label.trim())?.[1]?.toLowerCase() ?? "";
}

function truncateDisplayCode(value: string): string {
  return value.trim().slice(0, 4).toUpperCase();
}

function isImageDataUrl(dataUrl?: string): boolean {
  return typeof dataUrl === "string" && /^data:image\//i.test(dataUrl.trim());
}

export function isImageFileLike(file: ChatMessageFileView): boolean {
  const normalizedMimeType = file.mimeType.trim().toLowerCase();
  const extension = readFileExtension(file.label);
  return (
    file.isImage ||
    normalizedMimeType.startsWith("image/") ||
    IMAGE_EXTENSIONS.has(extension) ||
    isImageDataUrl(file.dataUrl)
  );
}

function resolveFileCategory(label: string, mimeType: string): FileCategory {
  const extension = readFileExtension(label);
  const normalizedMimeType = mimeType.toLowerCase();

  if (normalizedMimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) {
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
} {
  const category = resolveFileCategory(file.label, file.mimeType);
  const sizeLabel = formatFileSize(file.sizeBytes);
  return {
    category,
    extension: getFileExtension(file.label, file.mimeType),
    sizeLabel,
  };
}

export function getFileCategoryDisplayCode(
  category: FileCategory,
  extension: string,
): string {
  if (category === "image") {
    return "IMG";
  }
  if (category === "video") {
    return "VID";
  }
  if (category === "audio") {
    return "AUD";
  }
  if (category === "generic") {
    return truncateDisplayCode(extension || "FILE");
  }
  return truncateDisplayCode(extension);
}
