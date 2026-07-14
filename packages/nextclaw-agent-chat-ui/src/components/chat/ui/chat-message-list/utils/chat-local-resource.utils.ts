import type { ChatFileOpenActionViewModel } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

const SAFE_BROWSER_LINK_PROTOCOLS = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);
const URI_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-z]:[\\/]/i;
const WINDOWS_FILE_URI_PATH_PATTERN = /^\/[a-z]:[\\/]/i;
const FILE_URI_PROTOCOL = "file:";

function isSchemeLessResourceHref(href: string): boolean {
  return !href.startsWith("//") && !URI_SCHEME_PATTERN.test(href);
}

type LocalFileHref = {
  path: string;
  query: URLSearchParams;
  fragment: string;
};

function readPositiveInteger(value?: string): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readFileUriHref(href: string): LocalFileHref | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (
    url.protocol !== FILE_URI_PROTOCOL ||
    (url.hostname && url.hostname.toLowerCase() !== "localhost")
  ) {
    return null;
  }
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (WINDOWS_FILE_URI_PATH_PATTERN.test(path)) {
    path = path.slice(1);
  }
  return path
    ? { path, query: url.searchParams, fragment: url.hash.slice(1) }
    : null;
}

function readSchemeLessFileHref(href: string): LocalFileHref | null {
  const hashIndex = href.indexOf("#");
  const hrefWithoutFragment = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const fragment = hashIndex >= 0 ? href.slice(hashIndex + 1) : "";
  const queryIndex = hrefWithoutFragment.indexOf("?");
  const encodedPath = queryIndex >= 0
    ? hrefWithoutFragment.slice(0, queryIndex)
    : hrefWithoutFragment;
  const encodedQuery = queryIndex >= 0
    ? hrefWithoutFragment.slice(queryIndex + 1)
    : "";
  let path: string;
  try {
    path = decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
  return path
    ? { path, query: new URLSearchParams(encodedQuery), fragment }
    : null;
}

function readLinePosition(fragment: string): {
  line?: number;
  column?: number;
} {
  const match = /^L(\d+)(?:C(\d+))?(?:-L\d+(?:C\d+)?)?$/i.exec(fragment);
  const line = readPositiveInteger(match?.[1]);
  return {
    line,
    column: line ? readPositiveInteger(match?.[2]) : undefined,
  };
}

export function transformChatResourceHref(href: string): string {
  if (
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(href) ||
    isSchemeLessResourceHref(href)
  ) {
    return href;
  }
  try {
    const url = new URL(href);
    if (SAFE_BROWSER_LINK_PROTOCOLS.has(url.protocol)) {
      return href;
    }
    return url.protocol === FILE_URI_PROTOCOL && readFileUriHref(href)
      ? href
      : "";
  } catch {
    return "";
  }
}

export function resolveSafeChatResourceHref(href?: string): string | null {
  if (!href) {
    return null;
  }
  return transformChatResourceHref(href) || null;
}

export function isExternalChatResourceHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function parseChatLocalFileAction(
  href: string,
): ChatFileOpenActionViewModel | null {
  const fileHref = href.toLowerCase().startsWith(FILE_URI_PROTOCOL)
    ? readFileUriHref(href)
    : readSchemeLessFileHref(href);
  const path = fileHref?.path;
  if (
    !path ||
    path.startsWith("#") ||
    path.startsWith("//") ||
    (!WINDOWS_ABSOLUTE_PATH_PATTERN.test(path) && URI_SCHEME_PATTERN.test(path))
  ) {
    return null;
  }
  const viewer = fileHref.query.get("viewer");
  const fragmentPosition = readLinePosition(fileHref.fragment);
  const lineMatch = /^(.*?)(?::(\d+)(?::(\d+))?)$/.exec(path);
  const rawPath = lineMatch?.[1] ?? path;
  const line =
    fragmentPosition.line ??
    readPositiveInteger(lineMatch?.[2]);
  const column =
    fragmentPosition.column ??
    (line ? readPositiveInteger(lineMatch?.[3]) : undefined);
  return {
    path: rawPath,
    label: rawPath.split(/[\\/]/).filter(Boolean).pop() ?? rawPath,
    viewMode: "preview",
    ...(viewer === "source" || viewer === "rendered"
      ? { previewViewer: viewer }
      : {}),
    ...(typeof line === "number" ? { line } : {}),
    ...(typeof column === "number" ? { column } : {}),
  };
}
