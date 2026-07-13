import type { ChatFilePreviewViewer } from "@nextclaw/agent-chat-ui";

export type ChatWorkspaceFileViewer = "source" | "rendered";

function resolveDualViewFileKind(path: string): "html" | "markdown" | null {
  if (/\.html?$/i.test(path)) {
    return "html";
  }
  if (/\.mdx?$/i.test(path)) {
    return "markdown";
  }
  return null;
}

export function resolveWorkspaceFileViewer(
  path: string,
  viewer?: ChatFilePreviewViewer | null,
): ChatWorkspaceFileViewer | null {
  const kind = resolveDualViewFileKind(path);
  if (kind === "html") {
    return viewer === "rendered" ? "rendered" : "source";
  }
  if (kind === "markdown") {
    return viewer === "source" ? "source" : "rendered";
  }
  if (viewer === "source" || viewer === "rendered") {
    return viewer;
  }
  return null;
}

export function normalizeWorkspaceFilePreviewViewer(
  path: string,
  viewer?: ChatFilePreviewViewer | null,
): ChatFilePreviewViewer | null {
  return resolveWorkspaceFileViewer(path, viewer) ?? viewer ?? null;
}

export function resolveAlternateWorkspaceFileViewer(
  path: string,
  viewer?: ChatFilePreviewViewer | null,
): ChatWorkspaceFileViewer | null {
  if (!resolveDualViewFileKind(path)) {
    return null;
  }
  return resolveWorkspaceFileViewer(path, viewer) === "source"
    ? "rendered"
    : "source";
}
