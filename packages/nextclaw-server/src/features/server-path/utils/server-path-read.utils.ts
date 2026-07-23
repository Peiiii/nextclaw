import { open, stat, type FileHandle } from "node:fs/promises";
import { extname } from "node:path";
import type { ServerPathReadView } from "@nextclaw-server/shared/types/server-api.types.js";
import {
  resolveServerPath,
  ServerPathResolutionError,
} from "@nextclaw-server/features/server-path/utils/server-path-resolution.utils.js";

type ReadServerPathOptions = {
  path?: string | null;
  basePath?: string | null;
  line?: number | null;
  maxBytes?: number;
};

type ServerPathReadErrorCode =
  | "SERVER_PATH_BASE_REQUIRED"
  | "SERVER_PATH_NOT_FOUND"
  | "SERVER_PATH_NOT_FILE"
  | "SERVER_PATH_NOT_READABLE";

const DEFAULT_PREVIEW_MAX_BYTES = 200_000;
const PREVIEW_CONTEXT_LINES = 20;
const PREVIEW_SCAN_CHUNK_BYTES = 64_000;
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx", ".markdown"]);
const TEXT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".conf",
  ".cpp",
  ".css",
  ".csv",
  ".env",
  ".go",
  ".graphql",
  ".h",
  ".hpp",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".mjs",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

export class ServerPathReadError extends Error {
  constructor(
    readonly code: ServerPathReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServerPathReadError";
  }
}

function inferPreviewKind(path: string): "markdown" | "text" | "binary" {
  const extension = extname(path).toLowerCase();
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return "markdown";
  }
  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }
  return "binary";
}

function isLikelyTextBuffer(buffer: Buffer): boolean {
  for (const byte of buffer) {
    if (byte === 0) {
      return false;
    }
  }
  return true;
}

function readLanguageHint(path: string): string | null {
  const extension = extname(path).toLowerCase();
  if (!extension) {
    return null;
  }
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return "markdown";
  }
  return extension.slice(1) || null;
}

async function findPreviewWindowLocation(params: {
  fileHandle: FileHandle;
  maxBytes: number;
  sizeBytes: number;
  targetLine: number;
}): Promise<{ offset: number; startLine: number } | null> {
  const { fileHandle, maxBytes, sizeBytes, targetLine } = params;
  const lineStarts = [{ line: 1, offset: 0 }];
  const chunk = Buffer.alloc(Math.min(PREVIEW_SCAN_CHUNK_BYTES, sizeBytes));
  let currentLine = 1;
  let fileOffset = 0;

  while (fileOffset < sizeBytes) {
    const bytesToRead = Math.min(chunk.length, sizeBytes - fileOffset);
    const { bytesRead } = await fileHandle.read(
      chunk,
      0,
      bytesToRead,
      fileOffset,
    );
    if (bytesRead === 0) {
      break;
    }
    for (let index = 0; index < bytesRead; index += 1) {
      if (chunk[index] !== 10) {
        continue;
      }
      currentLine += 1;
      const targetOffset = fileOffset + index + 1;
      lineStarts.push({ line: currentLine, offset: targetOffset });
      if (lineStarts.length > PREVIEW_CONTEXT_LINES + 1) {
        lineStarts.shift();
      }
      if (currentLine === targetLine) {
        const contextStart = lineStarts[0]!;
        return targetOffset - contextStart.offset < maxBytes
          ? { offset: contextStart.offset, startLine: contextStart.line }
          : { offset: targetOffset, startLine: targetLine };
      }
    }
    fileOffset += bytesRead;
  }

  return null;
}

async function readFilePreviewBytes(params: {
  resolvedPath: string;
  sizeBytes: number;
  maxBytes: number;
  targetLine: number | null;
}): Promise<{ buffer: Buffer; startLine: number; truncated: boolean }> {
  const { maxBytes, resolvedPath, sizeBytes, targetLine } = params;
  const fileHandle = await open(resolvedPath, "r");
  try {
    const location =
      targetLine && targetLine > 1 && sizeBytes > maxBytes
        ? await findPreviewWindowLocation({
            fileHandle,
            maxBytes,
            sizeBytes,
            targetLine,
          })
        : null;
    const { offset, startLine } = location ?? { offset: 0, startLine: 1 };
    const bytesToRead = Math.min(sizeBytes - offset, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await fileHandle.read(
      buffer,
      0,
      bytesToRead,
      offset,
    );
    return {
      buffer: buffer.subarray(0, bytesRead),
      startLine,
      truncated: offset > 0 || offset + bytesRead < sizeBytes,
    };
  } finally {
    await fileHandle.close();
  }
}

export async function readServerPath(
  options: ReadServerPathOptions = {},
): Promise<ServerPathReadView> {
  const requestedPath = typeof options.path === "string" ? options.path.trim() : "";
  let resolvedPath: string;
  try {
    resolvedPath = resolveServerPath({ ...options, defaultToHome: true });
  } catch (error) {
    if (error instanceof ServerPathResolutionError) {
      throw new ServerPathReadError("SERVER_PATH_BASE_REQUIRED", error.message);
    }
    throw error;
  }

  let resolvedStats;
  try {
    resolvedStats = await stat(resolvedPath);
  } catch {
    throw new ServerPathReadError(
      "SERVER_PATH_NOT_FOUND",
      "server path does not exist",
    );
  }
  if (!resolvedStats.isFile()) {
    throw new ServerPathReadError(
      "SERVER_PATH_NOT_FILE",
      "server path must point to a file",
    );
  }

  let previewBytes;
  try {
    const targetLine =
      Number.isSafeInteger(options.line) && (options.line ?? 0) > 0
        ? (options.line ?? null)
        : null;
    previewBytes = await readFilePreviewBytes({
      resolvedPath,
      sizeBytes: resolvedStats.size,
      maxBytes: options.maxBytes ?? DEFAULT_PREVIEW_MAX_BYTES,
      targetLine,
    });
  } catch {
    throw new ServerPathReadError(
      "SERVER_PATH_NOT_READABLE",
      "server path is not readable",
    );
  }

  const inferredKind = inferPreviewKind(resolvedPath);
  const resolvedKind =
    inferredKind === "binary" && isLikelyTextBuffer(previewBytes.buffer)
      ? "text"
      : inferredKind;

  if (resolvedKind === "binary") {
    return {
      requestedPath: requestedPath || resolvedPath,
      resolvedPath,
      kind: "binary",
      sizeBytes: resolvedStats.size,
      startLine: 1,
      truncated: previewBytes.truncated,
      languageHint: readLanguageHint(resolvedPath),
    };
  }

  return {
    requestedPath: requestedPath || resolvedPath,
    resolvedPath,
    kind: resolvedKind,
    sizeBytes: resolvedStats.size,
    startLine: previewBytes.startLine,
    truncated: previewBytes.truncated,
    text: previewBytes.buffer.toString("utf8"),
    languageHint: readLanguageHint(resolvedPath),
  };
}

export function isServerPathReadError(
  error: unknown,
): error is ServerPathReadError {
  return error instanceof ServerPathReadError;
}
