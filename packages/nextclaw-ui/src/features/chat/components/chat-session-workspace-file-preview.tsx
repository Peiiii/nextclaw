import { useMemo } from "react";
import type { ChatFileOpenActionViewModel, ChatFileOperationBlockViewModel } from "@nextclaw/agent-chat-ui";
import { ChatMessageMarkdown, FileOperationCodeSurface } from "@nextclaw/agent-chat-ui";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import { ChatSessionWorkspaceFileBreadcrumbs } from "./workspace/chat-session-workspace-file-breadcrumbs";
import { useServerPathRead } from "@/hooks/server-path/use-server-path-read";
import { buildLineDiff, buildPreviewLines } from "@/features/chat/utils/file-operation/line-builder.utils";
import { t } from "@/lib/i18n";
import { buildWorkspaceFileBreadcrumb } from "@/lib/session-project/workspace-file-breadcrumb";
import { cn } from "@/lib/utils";

function inferPreviewKind(params: {
  path: string;
  serverKind?: "text" | "markdown" | "binary";
}): "text" | "markdown" | "binary" {
  if (params.serverKind) {
    return params.serverKind;
  }
  return /\.mdx?$/i.test(params.path) ? "markdown" : "text";
}

function buildPreviewBlock(params: {
  path: string;
  text: string;
  line?: number | null;
}): ChatFileOperationBlockViewModel {
  const { line, path, text } = params;
  const startLine = line ?? 1;
  return {
    key: `preview:${path}`,
    path,
    display: "preview",
    lines: buildPreviewLines({
      text,
      kind: "context",
      oldStartLine: startLine,
      newStartLine: startLine,
    }),
    rawText: text,
    oldStartLine: startLine,
    newStartLine: startLine,
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
}: {
  block: ChatFileOperationBlockViewModel;
}) {
  return <div className="h-full overflow-auto custom-scrollbar bg-white"><FileOperationCodeSurface block={block} layout="workspace" /></div>;
}

function WorkspacePreviewBody({
  onFileOpen,
  previewBlock,
  previewKind,
  previewQuery,
  previewText,
}: {
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  previewBlock: ChatFileOperationBlockViewModel | null;
  previewKind: "text" | "markdown" | "binary";
  previewQuery: ReturnType<typeof useServerPathRead>;
  previewText: string | null;
}) {
  if (previewQuery.isLoading && !previewBlock) {
    return <WorkspaceFilePreviewStatus text={t("chatWorkspaceLoadingFile")} />;
  }

  if (previewQuery.data?.kind === "binary") {
    return (
      <WorkspaceFilePreviewStatus text={t("chatWorkspacePreviewUnsupported")} />
    );
  }

  if (previewQuery.error && !previewBlock) {
    return (
      <WorkspaceFilePreviewStatus
        tone="error"
        text={
          previewQuery.error instanceof Error
            ? previewQuery.error.message
            : String(previewQuery.error)
        }
      />
    );
  }

  if (previewKind === "markdown" && previewText) {
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
        />
      </div>
    );
  }

  if (previewBlock) {
    return <WorkspaceCodeSurface block={previewBlock} />;
  }

  return <WorkspaceFilePreviewStatus text={t("chatWorkspacePreviewEmpty")} />;
}

type ChatSessionWorkspaceFilePreviewProps = { file: ChatWorkspaceFileTab; sessionProjectRoot: string | null; onFileOpen: (action: ChatFileOpenActionViewModel) => void };

export function ChatSessionWorkspaceFilePreview({
  file,
  sessionProjectRoot,
  onFileOpen,
}: ChatSessionWorkspaceFilePreviewProps) {
  const isPreviewMode = file.viewMode === "preview";
  const previewQuery = useServerPathRead({
    path: file.path,
    basePath: sessionProjectRoot,
    enabled: isPreviewMode,
  });
  const diffBlock = useMemo(
    () => (file.viewMode === "diff" ? buildDiffBlock(file) : null),
    [file],
  );
  const previewText =
    isPreviewMode ? previewQuery.data?.text ?? file.rawText ?? null : null;
  const previewKind = inferPreviewKind({
    path: previewQuery.data?.resolvedPath ?? file.path,
    serverKind: previewQuery.data?.kind,
  });
  const previewBlock = useMemo(() => {
    if (!isPreviewMode || !previewText) {
      return null;
    }
    return buildPreviewBlock({
      path: previewQuery.data?.resolvedPath ?? file.path,
      text: previewText,
      line: file.line,
    });
  }, [file.line, file.path, isPreviewMode, previewQuery.data?.resolvedPath, previewText]);
  const resolvedPath = previewQuery.data?.resolvedPath ?? file.path;
  const isTruncated = Boolean(previewQuery.data?.truncated);
  const breadcrumb = useMemo(
    () =>
      buildWorkspaceFileBreadcrumb({
        path: resolvedPath,
        sessionProjectRoot,
        line: file.line,
        column: file.column,
        truncated: isTruncated,
      }),
    [file.column, file.line, isTruncated, resolvedPath, sessionProjectRoot],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <ChatSessionWorkspaceFileBreadcrumbs breadcrumb={breadcrumb} />

      <div className="flex-1 min-h-0 overflow-hidden">
        {file.viewMode === "diff" ? (
          <WorkspaceDiffBody diffBlock={diffBlock} />
        ) : (
          <WorkspacePreviewBody
            onFileOpen={onFileOpen}
            previewBlock={previewBlock}
            previewKind={previewKind}
            previewQuery={previewQuery}
            previewText={previewText}
          />
        )}
      </div>
    </div>
  );
}
