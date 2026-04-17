import { open, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, resolve } from "node:path";
import { expandHome } from "@nextclaw/core";
import type { ServerPathReadView } from "../types.js";

type ReadServerPathOptions = {
  path?: string | null;
  basePath?: string | null;
  maxBytes?: number;
};

type ServerPathReadErrorCode =
  | "SERVER_PATH_BASE_REQUIRED"
  | "SERVER_PATH_NOT_FOUND"
  | "SERVER_PATH_NOT_FILE"
  | "SERVER_PATH_NOT_READABLE";

const DEFAULT_PREVIEW_MAX_BYTES = 200_000;
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

function normalizeReadPath(params: {
  path?: string | null;
  basePath?: string | null;
}): string {
  const { basePath, path } = params;
  const rawPath = typeof path === "string" ? path.trim() : "";
  const normalizedBasePath =
    typeof basePath === "string" ? basePath.trim() : "";
  if (!rawPath) {
    return resolve(expandHome(normalizedBasePath || homedir()));
  }
  const expandedPath = expandHome(rawPath);
  if (expandedPath.startsWith("/")) {
    return resolve(expandedPath);
  }
  if (!normalizedBasePath) {
    throw new ServerPathReadError(
      "SERVER_PATH_BASE_REQUIRED",
      "relative server path requires a base path",
    );
  }
  const resolvedBasePath = expandHome(normalizedBasePath);
  return resolve(resolvedBasePath, expandedPath);
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

async function readFilePreviewBytes(params: {
  resolvedPath: string;
  sizeBytes: number;
  maxBytes: number;
}): Promise<{ buffer: Buffer; truncated: boolean }> {
  const { maxBytes, resolvedPath, sizeBytes } = params;
  const bytesToRead = Math.min(sizeBytes, maxBytes);
  const fileHandle = await open(resolvedPath, "r");
  try {
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, 0);
    return {
      buffer: buffer.subarray(0, bytesRead),
      truncated: sizeBytes > maxBytes,
    };
  } finally {
    await fileHandle.close();
  }
}

export async function readServerPath(
  options: ReadServerPathOptions = {},
): Promise<ServerPathReadView> {
  const requestedPath = typeof options.path === "string" ? options.path.trim() : "";
  const resolvedPath = normalizeReadPath(options);

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
    previewBytes = await readFilePreviewBytes({
      resolvedPath,
      sizeBytes: resolvedStats.size,
      maxBytes: options.maxBytes ?? DEFAULT_PREVIEW_MAX_BYTES,
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
      truncated: previewBytes.truncated,
      languageHint: readLanguageHint(resolvedPath),
    };
  }

  return {
    requestedPath: requestedPath || resolvedPath,
    resolvedPath,
    kind: resolvedKind,
    sizeBytes: resolvedStats.size,
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
