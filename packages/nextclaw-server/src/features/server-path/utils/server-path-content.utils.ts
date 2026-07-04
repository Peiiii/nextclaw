import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const SERVER_PATH_CONTENT_ROUTE_PREFIX = "/api/server-paths/content/";
const SERVER_PATH_CONTENT_ABSOLUTE_SCOPE = "__abs__";
const SERVER_PATH_CONTENT_WINDOWS_SCOPE = "__win__";

type ServerPathContentErrorCode =
  | "SERVER_PATH_CONTENT_INVALID"
  | "SERVER_PATH_NOT_FOUND"
  | "SERVER_PATH_NOT_FILE"
  | "SERVER_PATH_NOT_READABLE";

export type ServerPathContentView = {
  content: Buffer;
  contentType: string;
  fileName: string;
};

export class ServerPathContentError extends Error {
  constructor(
    readonly code: ServerPathContentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServerPathContentError";
  }
}

function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new ServerPathContentError(
      "SERVER_PATH_CONTENT_INVALID",
      "invalid server path content route",
    );
  }
}

function readServerPathContentRoutePath(url: string): string {
  const pathname = new URL(url).pathname;
  if (!pathname.startsWith(SERVER_PATH_CONTENT_ROUTE_PREFIX)) {
    throw new ServerPathContentError(
      "SERVER_PATH_CONTENT_INVALID",
      "invalid server path content route",
    );
  }

  const [scope, ...segments] = pathname
    .slice(SERVER_PATH_CONTENT_ROUTE_PREFIX.length)
    .split("/")
    .filter(Boolean)
    .map(decodeRouteSegment);
  if (!scope || segments.length === 0) {
    throw new ServerPathContentError(
      "SERVER_PATH_CONTENT_INVALID",
      "invalid server path content route",
    );
  }

  if (scope === SERVER_PATH_CONTENT_ABSOLUTE_SCOPE) {
    return resolve("/", ...segments);
  }
  if (scope === SERVER_PATH_CONTENT_WINDOWS_SCOPE) {
    const [drive, ...rest] = segments;
    if (!drive) {
      throw new ServerPathContentError(
        "SERVER_PATH_CONTENT_INVALID",
        "invalid server path content route",
      );
    }
    return resolve(`${drive}\\`, ...rest);
  }

  throw new ServerPathContentError(
    "SERVER_PATH_CONTENT_INVALID",
    "invalid server path content route",
  );
}

function inferContentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
    case ".jsx":
    case ".ts":
    case ".tsx":
      return "application/javascript; charset=utf-8";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".ico":
      return "image/x-icon";
    case ".wasm":
      return "application/wasm";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".otf":
      return "font/otf";
    case ".mp3":
      return "audio/mpeg";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

export async function readServerPathContent(
  url: string,
): Promise<ServerPathContentView> {
  const resolvedPath = readServerPathContentRoutePath(url);

  let resolvedStats;
  try {
    resolvedStats = await stat(resolvedPath);
  } catch {
    throw new ServerPathContentError(
      "SERVER_PATH_NOT_FOUND",
      "server path does not exist",
    );
  }
  if (!resolvedStats.isFile()) {
    throw new ServerPathContentError(
      "SERVER_PATH_NOT_FILE",
      "server path must point to a file",
    );
  }

  try {
    return {
      content: await readFile(resolvedPath),
      contentType: inferContentType(resolvedPath),
      fileName: basename(resolvedPath),
    };
  } catch {
    throw new ServerPathContentError(
      "SERVER_PATH_NOT_READABLE",
      "server path is not readable",
    );
  }
}

export function isServerPathContentError(
  error: unknown,
): error is ServerPathContentError {
  return error instanceof ServerPathContentError;
}
