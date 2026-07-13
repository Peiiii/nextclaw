import type { ChatFileOpenActionViewModel } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const URI_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-z]:[\\/]/i;

function isSchemeLessResourceHref(href: string): boolean {
  return !href.startsWith("//") && !URI_SCHEME_PATTERN.test(href);
}

export function resolveSafeChatResourceHref(href?: string): string | null {
  if (!href) {
    return null;
  }
  if (
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(href) ||
    isSchemeLessResourceHref(href)
  ) {
    return href;
  }
  try {
    const url = new URL(href);
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

export function isExternalChatResourceHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function parseChatLocalFileAction(
  href: string,
): ChatFileOpenActionViewModel | null {
  const normalizedHref = href.split("#")[0] ?? href;
  const [encodedPath, encodedQuery = ""] = normalizedHref.split("?", 2);
  let path: string;
  try {
    path = decodeURIComponent(encodedPath ?? normalizedHref);
  } catch {
    return null;
  }
  if (
    !path ||
    path.startsWith("#") ||
    path.startsWith("//") ||
    (!WINDOWS_ABSOLUTE_PATH_PATTERN.test(path) && URI_SCHEME_PATTERN.test(path))
  ) {
    return null;
  }
  const viewer = new URLSearchParams(encodedQuery).get("viewer");
  const lineMatch = /^(.*?)(?::(\d+)(?::(\d+))?)$/.exec(path);
  const rawPath = lineMatch?.[1] ?? path;
  const line = lineMatch?.[2] ? Number(lineMatch[2]) : undefined;
  const column = lineMatch?.[3] ? Number(lineMatch[3]) : undefined;
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
