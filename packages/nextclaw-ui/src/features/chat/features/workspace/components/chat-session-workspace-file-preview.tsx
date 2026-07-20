import { useMemo } from "react";
import type {
  ChatFileOpenActionViewModel,
  ChatFileOperationBlockViewModel,
} from "@nextclaw/agent-chat-ui";
import { NextClawClientError } from "@nextclaw/client-sdk";
import {
  ChatMessageMarkdown,
  FileOperationCodeSurface,
} from "@nextclaw/agent-chat-ui";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import { ChatSessionWorkspaceDirectoryBrowser } from "./chat-session-workspace-directory-browser";
import { ChatSessionWorkspaceFileBreadcrumbs } from "./chat-session-workspace-file-breadcrumbs";
import {
  resolveWorkspaceFileContentKind,
  WorkspaceFileContentPreview,
  type WorkspaceFileContentKind,
} from "./workspace-file-content-preview";
import { useServerPathBrowse } from "@/shared/hooks/use-server-path-browse";
import { useServerPathRead } from "@/shared/hooks/use-server-path-read";
import { buildServerPathContentUrl } from "@/shared/lib/api";
import {
  buildLineDiff,
  buildPreviewLines,
} from "@/features/chat/features/message/utils/file-operation/line-builder.utils";
import { t } from "@/shared/lib/i18n";
import { buildWorkspaceFileBreadcrumb } from "@/shared/lib/session-project";
import { cn } from "@/shared/lib/utils";
import { resolveWorkspaceFileViewer } from "@/features/chat/features/workspace/utils/chat-workspace-file-viewer.utils";

function inferPreviewKind(params: {
  path: string;
  serverKind?: "text" | "markdown" | "binary";
}): "text" | "markdown" | "binary" {
  if (params.serverKind) {
    return params.serverKind;
  }
  return /\.mdx?$/i.test(params.path) ? "markdown" : "text";
}

function appendPreviewRefreshVersion(
  url: string,
  refreshVersion: number,
): string {
  if (refreshVersion <= 0) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}refresh=${refreshVersion}`;
}

function buildPreviewBlock(params: {
  path: string;
  text: string;
  languageHint?: string | null;
  startLine?: number | null;
}): ChatFileOperationBlockViewModel {
  const { languageHint, path, startLine, text } = params;
  const normalizedStartLine = startLine ?? 1;
  return {
    key: `preview:${path}`,
    path,
    display: "preview",
    lines: buildPreviewLines({
      text,
      kind: "context",
      oldStartLine: normalizedStartLine,
      newStartLine: normalizedStartLine,
    }),
    rawText: text,
    languageHint: languageHint ?? null,
    oldStartLine: normalizedStartLine,
    newStartLine: normalizedStartLine,
  };
}

function buildDiffBlock(
  file: ChatWorkspaceFileTab,
): ChatFileOperationBlockViewModel | null {
  if (Array.isArray(file.fullLines) && file.fullLines.length > 0) {
    return {
      key: `diff:${file.key}`,
      path: file.path,
      display: "diff",
      lines: file.fullLines,
      fullLines: file.fullLines,
      ...(file.beforeText ? { beforeText: file.beforeText } : {}),
      ...(file.afterText ? { afterText: file.afterText } : {}),
      ...(file.patchText ? { patchText: file.patchText } : {}),
      ...(typeof file.oldStartLine === "number"
        ? { oldStartLine: file.oldStartLine }
        : {}),
      ...(typeof file.newStartLine === "number"
        ? { newStartLine: file.newStartLine }
        : {}),
    };
  }

  if (file.beforeText == null && file.afterText == null) {
    return null;
  }

  const lines = buildLineDiff({
    beforeText: file.beforeText ?? "",
    afterText: file.afterText ?? "",
    oldStartLine: file.oldStartLine ?? undefined,
    newStartLine: file.newStartLine ?? undefined,
  });

  return {
    key: `diff:${file.key}`,
    path: file.path,
    display: "diff",
    lines,
    fullLines: lines,
    ...(file.beforeText ? { beforeText: file.beforeText } : {}),
    ...(file.afterText ? { afterText: file.afterText } : {}),
    ...(typeof file.oldStartLine === "number"
      ? { oldStartLine: file.oldStartLine }
      : {}),
    ...(typeof file.newStartLine === "number"
      ? { newStartLine: file.newStartLine }
      : {}),
  };
}

function WorkspaceFilePreviewStatus({
  text,
  tone = "muted",
}: {
  text: string;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center px-6 text-center text-sm",
        tone === "error" ? "text-rose-600" : "text-gray-500",
      )}
    >
      {text}
    </div>
  );
}

export function resolveWorkspacePreviewErrorText(error: unknown): string {
  return error instanceof NextClawClientError &&
    error.code === "SERVER_PATH_NOT_FOUND"
    ? t("chatWorkspacePreviewNotFound")
    : t("chatWorkspacePreviewFailed");
}

function WorkspaceDiffBody({
  diffBlock,
}: {
  diffBlock: ChatFileOperationBlockViewModel | null;
}) {
  if (!diffBlock) {
    return <WorkspaceFilePreviewStatus text={t("chatWorkspaceDiffEmpty")} />;
  }
  return <WorkspaceCodeSurface block={diffBlock} />;
}

function WorkspaceCodeSurface({
  block,
  targetColumn,
  targetLine,
}: {
  block: ChatFileOperationBlockViewModel;
  targetColumn?: number | null;
  targetLine?: number | null;
}) {
  return (
    <div className="h-full overflow-auto custom-scrollbar bg-white">
      <FileOperationCodeSurface
        block={block}
        layout="workspace"
        targetColumn={targetColumn}
        targetLine={targetLine}
      />
    </div>
  );
}

function WorkspacePreviewBody({
  contentUrl,
  contentUrlKind,
  contentLabel,
  directoryQuery,
  fileBasePath,
  onFileOpen,
  onHtmlContentHeightChange,
  previewBlock,
  previewKind,
  previewViewer,
  previewQuery,
  previewText,
  targetColumn,
  targetLine,
}: {
  contentUrl: string | null;
  contentUrlKind: WorkspaceFileContentKind | null;
  contentLabel: string;
  directoryQuery: ReturnType<typeof useServerPathBrowse> | null | undefined;
  fileBasePath: string | null;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  onHtmlContentHeightChange?: (height: number) => void;
  previewBlock: ChatFileOperationBlockViewModel | null;
  previewKind: "text" | "markdown" | "binary";
  previewViewer: "source" | "rendered" | null;
  previewQuery: ReturnType<typeof useServerPathRead> | null | undefined;
  previewText: string | null;
  targetColumn?: number | null;
  targetLine?: number | null;
}) {
  if (contentUrl && contentUrlKind) {
    return (
      <WorkspaceFileContentPreview
        contentUrl={contentUrl}
        kind={contentUrlKind}
        label={contentLabel}
        onHtmlContentHeightChange={onHtmlContentHeightChange}
      />
    );
  }

  if (directoryQuery?.data) {
    return (
      <ChatSessionWorkspaceDirectoryBrowser
        browseQuery={directoryQuery}
        onFileOpen={onFileOpen}
        renderStatus={(params) => <WorkspaceFilePreviewStatus {...params} />}
      />
    );
  }

  if (directoryQuery?.isLoading && previewQuery?.error && !previewBlock) {
    return (
      <WorkspaceFilePreviewStatus text={t("chatWorkspaceLoadingDirectory")} />
    );
  }

  if ((directoryQuery?.isLoading || previewQuery?.isLoading) && !previewBlock) {
    return (
      <WorkspaceFilePreviewStatus text={t("chatWorkspaceLoadingPreview")} />
    );
  }

  if (previewQuery?.data?.kind === "binary") {
    return (
      <WorkspaceFilePreviewStatus text={t("chatWorkspacePreviewUnsupported")} />
    );
  }

  if (previewQuery?.error && !previewBlock) {
    return (
      <WorkspaceFilePreviewStatus
        tone="error"
        text={resolveWorkspacePreviewErrorText(previewQuery.error)}
      />
    );
  }

  if (previewKind === "markdown" && previewViewer !== "source" && previewText) {
    return (
      <div className="h-full overflow-auto custom-scrollbar px-5 py-4">
        <ChatMessageMarkdown
          text={previewText}
          role="assistant"
          texts={{
            copyCodeLabel: t("chatCodeCopy"),
            copiedCodeLabel: t("chatCodeCopied"),
          }}
          onFileOpen={onFileOpen}
          resolveFileContentUrl={(action) =>
            buildServerPathContentUrl(action.path, fileBasePath)
          }
        />
      </div>
    );
  }

  if (previewBlock) {
    return (
      <WorkspaceCodeSurface
        block={previewBlock}
        targetColumn={targetColumn}
        targetLine={targetLine}
      />
    );
  }

  return <WorkspaceFilePreviewStatus text={t("chatWorkspacePreviewEmpty")} />;
}

type ChatSessionWorkspaceFilePreviewProps = {
  file: ChatWorkspaceFileTab;
  refreshVersion?: number;
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
  showBreadcrumbs?: boolean;
  onHtmlContentHeightChange?: (height: number) => void;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
};

export function ChatSessionWorkspaceFilePreview({
  file,
  refreshVersion = 0,
  sessionProjectRoot,
  sessionWorkingDir,
  showBreadcrumbs = true,
  onHtmlContentHeightChange,
  onFileOpen,
}: ChatSessionWorkspaceFilePreviewProps) {
  const isPreviewMode = file.viewMode === "preview";
  const suppliedContentUrl = file.contentUrl?.trim() || null;
  const usesServerPath = isPreviewMode && !suppliedContentUrl;
  const previewQuery = useServerPathRead({
    path: file.path,
    basePath: sessionWorkingDir,
    line: file.line,
    enabled: usesServerPath,
  });
  const directoryQuery = useServerPathBrowse({
    path: file.path,
    basePath: sessionWorkingDir,
    includeFiles: true,
    enabled: usesServerPath,
  });
  const diffBlock = useMemo(
    () => (file.viewMode === "diff" ? buildDiffBlock(file) : null),
    [file],
  );
  const previewText = isPreviewMode
    ? (previewQuery?.data?.text ?? file.rawText ?? null)
    : null;
  const previewKind = inferPreviewKind({
    path: previewQuery?.data?.resolvedPath ?? file.path,
    serverKind: previewQuery?.data?.kind,
  });
  const suppliedContentKind = suppliedContentUrl
    ? resolveWorkspaceFileContentKind({
        path: file.path,
        mimeType: file.mimeType,
      })
    : null;
  const resolvedPath =
    directoryQuery?.data?.currentPath ??
    previewQuery?.data?.resolvedPath ??
    file.path;
  const previewPathKind = directoryQuery?.data ? "directory" : "file";
  const previewViewer = resolveWorkspaceFileViewer(
    resolvedPath,
    file.previewViewer,
  );
  const localContentKind = resolveWorkspaceFileContentKind({
    path: resolvedPath,
  });
  const localContentUrlCandidate = buildServerPathContentUrl(
    file.path,
    sessionWorkingDir,
  );
  const shouldRenderLocalContent = Boolean(
    !suppliedContentUrl &&
    isPreviewMode &&
    localContentUrlCandidate &&
    file.previewViewer !== "source" &&
    localContentKind !== "other" &&
    (localContentKind !== "html" || previewViewer === "rendered"),
  );
  const localContentUrl =
    shouldRenderLocalContent && localContentUrlCandidate
      ? appendPreviewRefreshVersion(localContentUrlCandidate, refreshVersion)
      : null;
  const contentUrl = suppliedContentUrl ?? localContentUrl;
  const contentUrlKind =
    suppliedContentKind ?? (localContentUrl ? localContentKind : null);
  const previewBlock = useMemo(() => {
    if (!isPreviewMode || !previewText || contentUrl) {
      return null;
    }
    return buildPreviewBlock({
      path: previewQuery?.data?.resolvedPath ?? file.path,
      text: previewText,
      languageHint: previewQuery?.data?.languageHint ?? null,
      startLine: previewQuery?.data?.startLine ?? 1,
    });
  }, [
    contentUrl,
    file.path,
    isPreviewMode,
    previewQuery?.data?.languageHint,
    previewQuery?.data?.resolvedPath,
    previewQuery?.data?.startLine,
    previewText,
  ]);
  const isTextPreviewTruncated =
    !contentUrl && Boolean(previewQuery?.data?.truncated);
  const breadcrumbBasePath = sessionProjectRoot ?? sessionWorkingDir;
  const breadcrumb = useMemo(
    () =>
      buildWorkspaceFileBreadcrumb({
        path: resolvedPath,
        kind: previewPathKind,
        sessionProjectRoot: breadcrumbBasePath,
        truncated: isTextPreviewTruncated,
      }),
    [breadcrumbBasePath, isTextPreviewTruncated, previewPathKind, resolvedPath],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {showBreadcrumbs ? (
        <ChatSessionWorkspaceFileBreadcrumbs
          breadcrumb={breadcrumb}
          onFileOpen={onFileOpen}
        />
      ) : null}

      <div className="flex-1 min-h-0 overflow-hidden">
        {file.viewMode === "diff" ? (
          <WorkspaceDiffBody diffBlock={diffBlock} />
        ) : (
          <WorkspacePreviewBody
            contentUrl={contentUrl}
            contentUrlKind={contentUrlKind}
            contentLabel={file.label?.trim() || resolvedPath}
            directoryQuery={directoryQuery}
            fileBasePath={sessionWorkingDir}
            onFileOpen={onFileOpen}
            onHtmlContentHeightChange={onHtmlContentHeightChange}
            previewBlock={previewBlock}
            previewKind={previewKind}
            previewViewer={previewViewer}
            previewQuery={previewQuery}
            previewText={previewText}
            targetColumn={file.column}
            targetLine={file.line}
          />
        )}
      </div>
    </div>
  );
}
