import { createWorkspaceFileTab } from "./chat-workspace-file-tab.utils";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import {
  normalizePersistedWorkspaceFileTab,
  toPersistedWorkspaceFileTab,
} from "./chat-workspace-file-tab-persistence.utils";
import type {
  DocBrowserRouteTarget,
  DocBrowserTab,
} from "@/shared/components/doc-browser/types/doc-browser.types";

export const WORKSPACE_FILE_PANEL_KIND = "workspace-file";
export type WorkspaceFileViewContext = {
  workingDir: string | null;
  projectRoot: string | null;
};
export type WorkspaceFileView = WorkspaceFileViewContext & {
  file: ChatWorkspaceFileTab;
};

export function createWorkspaceFilePanelTarget(
  file: ChatWorkspaceFileTab,
  context: WorkspaceFileViewContext,
): DocBrowserRouteTarget {
  const query = new URLSearchParams({
    key: file.key,
    path: file.path,
    base: context.workingDir ?? "",
    parent: file.parentSessionKey ?? "",
    view: file.viewMode,
    viewer: file.previewViewer ?? "",
    line: String(file.line ?? ""),
    column: String(file.column ?? ""),
  });
  const url = `nextclaw://workspace-file?${query}`;
  return {
    kind: WORKSPACE_FILE_PANEL_KIND,
    title: file.label || file.path.split("/").pop() || file.path,
    url,
    resourceUri: url,
    dedupeKey: url,
    historyPolicy: "none",
    viewState: {
      ...context,
      file: toPersistedWorkspaceFileTab(file),
    } satisfies WorkspaceFileView,
  };
}

export function readWorkspaceFilePanelView(
  tab: DocBrowserTab,
): WorkspaceFileView | null {
  let value = tab.viewState;
  if (!value) {
    try {
      const uri = new URL(tab.resourceUri ?? tab.currentUrl);
      const path = uri.searchParams.get("path");
      // A diff is a historical snapshot; a bare URI cannot substitute current file content.
      if (
        uri.hostname !== "workspace-file" ||
        !path ||
        uri.searchParams.get("view") === "diff"
      )
        return null;
      value = {
        workingDir: uri.searchParams.get("base") || null,
        projectRoot: null,
        file: {
          key: uri.searchParams.get("key") || path,
          path,
          parentSessionKey: uri.searchParams.get("parent") || null,
          viewMode: "preview",
          line: Number(uri.searchParams.get("line")) || null,
          column: Number(uri.searchParams.get("column")) || null,
          previewViewer: uri.searchParams.get("viewer") || undefined,
        },
      };
    } catch {
      return null;
    }
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("file" in value) ||
    !("workingDir" in value) ||
    !("projectRoot" in value)
  )
    return null;
  const file = normalizePersistedWorkspaceFileTab(value.file);
  if (
    !file ||
    (value.workingDir !== null && typeof value.workingDir !== "string") ||
    (value.projectRoot !== null && typeof value.projectRoot !== "string")
  )
    return null;
  return { file, workingDir: value.workingDir, projectRoot: value.projectRoot };
}

/** Resolve public file links with explicit source context; never borrow another conversation's cwd. */
export function resolveFileResourceTarget(
  uri: string,
  context?: { workingDir?: string | null; sessionKey?: string | null },
): DocBrowserRouteTarget | null {
  const parsed = new URL(uri);
  if (parsed.protocol !== "nextclaw:" || parsed.hostname !== "file")
    return null;
  const [scope, ...segments] = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  if (
    !segments.length ||
    segments.some(
      (segment) =>
        segment === ".." || segment.includes("\\") || segment.includes("/"),
    )
  )
    return null;
  const path = segments.join("/");
  const base = parsed.searchParams.get("base") || context?.workingDir || null;
  if (scope !== "absolute" && (scope !== "workspace" || !base?.startsWith("/")))
    return null;
  const viewer =
    parsed.searchParams.get("view") || parsed.searchParams.get("viewer");
  const positive = (name: string) => {
    const value = Number(parsed.searchParams.get(name));
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  };
  const file = createWorkspaceFileTab(
    {
      path: scope === "absolute" ? "/" + path : path,
      viewMode: "preview",
      previewViewer:
        viewer === "source" || viewer === "rendered" ? viewer : undefined,
      line: positive("line"),
      column: positive("column"),
    },
    context?.sessionKey ?? null,
  );
  return file
    ? createWorkspaceFilePanelTarget(file, {
        workingDir: scope === "workspace" ? base : null,
        projectRoot: null,
      })
    : null;
}
