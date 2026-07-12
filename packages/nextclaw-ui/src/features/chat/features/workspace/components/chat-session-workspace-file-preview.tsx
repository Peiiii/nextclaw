import { useMemo } from "react";
import type {
  ChatFileOpenActionViewModel,
  ChatFileOperationBlockViewModel,
  ChatFilePreviewViewer,
} from "@nextclaw/agent-chat-ui";
import {
  ChatMessageMarkdown,
  FileOperationCodeSurface,
} from "@nextclaw/agent-chat-ui";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import { ChatSessionWorkspaceDirectoryBrowser } from "./chat-session-workspace-directory-browser";
import { ChatSessionWorkspaceFileBreadcrumbs } from "./chat-session-workspace-file-breadcrumbs";
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

function inferPreviewKind(params: {
  path: string;
  serverKind?: "text" | "markdown" | "binary";
}): "text" | "markdown" | "binary" {
  if (params.serverKind) {
    return params.serverKind;
  }
  return /\.mdx?$/i.test(params.path) ? "markdown" : "text";
}

function resolveFilePreviewViewer(params: {
  path: string;
  viewer?: ChatFilePreviewViewer | null;
}): "source" | "rendered" {
  return params.viewer === "rendered" && /\.html?$/i.test(params.path) ? "rendered" : "source";
}

type ContentUrlPreviewKind = "image" | "audio" | "video" | "pdf" | "html" | "other";

function resolveContentUrlPreviewKind(params: {
  path: string;
  mimeType?: string | null;
}): ContentUrlPreviewKind {
  const mime = params.mimeType?.trim().toLowerCase() ?? "";
  const path = params.path.trim().toLowerCase();
  if (mime.startsWith("image/") || /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i.test(path)) {
    return "image";
  }
  if (mime.startsWith("audio/") || /\.(aac|flac|m4a|mp3|ogg|opus|wav|weba)$/i.test(path)) {
    return "audio";
  }
  if (mime.startsWith("video/") || /\.(avi|m4v|mkv|mov|mp4|webm|wmv)$/i.test(path)) {
    return "video";
  }
  if (mime.includes("pdf") || path.endsWith(".pdf")) {
    return "pdf";
  }
  if (mime.includes("html") || /\.html?$/i.test(path)) {
    return "html";
  }
  return "other";
}

function appendPreviewRefreshVersion(url: string, refreshVersion: number): string {
  if (refreshVersion <= 0) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}refresh=${refreshVersion}`;
}

function buildPreviewBlock(params: {
  path: string;
  text: string;
  languageHint?: string | null;
  line?: number | null;
}): ChatFileOperationBlockViewModel {
  const { languageHint, line, path, text } = params;
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
    languageHint: languageHint ?? null,
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

function WorkspaceHtmlRenderedPreview({
  src,
}: {
  src: string;
}) {
  return (
    <iframe
      allowFullScreen
      className="h-full w-full border-0 bg-white"
      data-testid="workspace-html-preview"
      src={src}
      title={t("chatWorkspaceHtmlPreviewTitle")}
    />
  );
}

function WorkspaceContentUrlPreview({
  contentUrl,
  kind,
  label,
}: {
  contentUrl: string;
  kind: ContentUrlPreviewKind;
  label: string;
}) {
  if (kind === "image") {
    return (
      <div className="flex h-full items-center justify-center overflow-auto custom-scrollbar bg-white p-4">
        <img
          src={contentUrl}
          alt={label}
          className="max-h-full max-w-full object-contain"
          data-testid="workspace-content-image"
        />
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className="flex h-full items-center justify-center bg-white px-6">
        <audio
          controls
          preload="metadata"
          aria-label={label}
          className="w-full max-w-xl"
          data-testid="workspace-content-audio"
          src={contentUrl}
        />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <video
          controls
          playsInline
          preload="metadata"
          aria-label={label}
          className="max-h-full max-w-full"
          data-testid="workspace-content-video"
          src={contentUrl}
        />
      </div>
    );
  }
  if (kind === "pdf" || kind === "html") {
    return (
      <iframe
        allowFullScreen
        className="h-full w-full border-0 bg-white"
        data-testid={kind === "pdf" ? "workspace-content-pdf" : "workspace-html-preview"}
        src={contentUrl}
        title={label}
      />
    );
  }
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
      data-testid="workspace-content-unsupported"
    >
      <div className="max-w-sm space-y-1.5">
        <p className="truncate text-sm font-medium text-foreground" title={label}>
          {label}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("chatWorkspacePreviewUnsupported")}
        </p>
        <p className="text-xs leading-5 text-muted-foreground/80">
          {t("chatWorkspacePreviewUnsupportedHint")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <a
          href={contentUrl}
          download={label}
          className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          {t("chatWorkspacePreviewDownload")}
        </a>
        <a
          href={contentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("chatWorkspacePreviewOpenExternally")}
        </a>
      </div>
    </div>
  );
}

function WorkspacePreviewBody({
  contentUrl,
  contentUrlKind,
  contentLabel,
  directoryQuery,
  onFileOpen,
  previewBlock,
  previewKind,
  previewQuery,
  previewText,
  previewUrl,
  previewViewer,
}: {
  contentUrl: string | null;
  contentUrlKind: ContentUrlPreviewKind | null;
  contentLabel: string;
  directoryQuery: ReturnType<typeof useServerPathBrowse> | null | undefined;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  previewBlock: ChatFileOperationBlockViewModel | null;
  previewKind: "text" | "markdown" | "binary";
  previewQuery: ReturnType<typeof useServerPathRead> | null | undefined;
  previewText: string | null;
  previewUrl: string | null;
  previewViewer: "source" | "rendered";
}) {
  if (contentUrl && contentUrlKind) {
    return (
      <WorkspaceContentUrlPreview
        contentUrl={contentUrl}
        kind={contentUrlKind}
        label={contentLabel}
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
        text={
          previewQuery.error instanceof Error
            ? previewQuery.error.message
            : String(previewQuery.error)
        }
      />
    );
  }

  if (previewViewer === "rendered" && previewUrl) {
    return <WorkspaceHtmlRenderedPreview src={previewUrl} />;
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

type ChatSessionWorkspaceFilePreviewProps = {
  file: ChatWorkspaceFileTab;
  refreshVersion?: number;
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
};

export function ChatSessionWorkspaceFilePreview({
  file,
  refreshVersion = 0,
  sessionProjectRoot,
  sessionWorkingDir,
  onFileOpen,
}: ChatSessionWorkspaceFilePreviewProps) {
  const isPreviewMode = file.viewMode === "preview";
  const contentUrl = file.contentUrl?.trim() || null;
  const usesServerPath = isPreviewMode && !contentUrl;
  const previewQuery = useServerPathRead({
    path: file.path,
    basePath: sessionWorkingDir,
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
  const previewText =
    isPreviewMode ? previewQuery?.data?.text ?? file.rawText ?? null : null;
  const previewKind = inferPreviewKind({
    path: previewQuery?.data?.resolvedPath ?? file.path,
    serverKind: previewQuery?.data?.kind,
  });
  const contentUrlKind = contentUrl
    ? resolveContentUrlPreviewKind({
        path: file.path,
        mimeType: file.mimeType,
      })
    : null;
  const resolvedPath =
    directoryQuery?.data?.currentPath ??
    previewQuery?.data?.resolvedPath ??
    file.path;
  const previewPathKind = directoryQuery?.data ? "directory" : "file";
  const previewViewer = resolveFilePreviewViewer({
    path: resolvedPath,
    viewer: file.previewViewer,
  });
  const previewUrl =
    previewViewer === "rendered" && previewQuery?.data?.resolvedPath
      ? appendPreviewRefreshVersion(
          buildServerPathContentUrl(previewQuery.data.resolvedPath),
          refreshVersion,
        )
      : null;
  const previewBlock = useMemo(() => {
    if (!isPreviewMode || !previewText || contentUrl) {
      return null;
    }
    return buildPreviewBlock({
      path: previewQuery?.data?.resolvedPath ?? file.path,
      text: previewText,
      languageHint: previewQuery?.data?.languageHint ?? null,
      line: file.line,
    });
  }, [
    contentUrl,
    file.line,
    file.path,
    isPreviewMode,
    previewQuery?.data?.languageHint,
    previewQuery?.data?.resolvedPath,
    previewText,
  ]);
  const isTruncated = Boolean(previewQuery?.data?.truncated);
  const breadcrumbBasePath = sessionProjectRoot ?? sessionWorkingDir;
  const breadcrumb = useMemo(
    () =>
      buildWorkspaceFileBreadcrumb({
        path: resolvedPath,
        kind: previewPathKind,
        sessionProjectRoot: breadcrumbBasePath,
        line: file.line,
        column: file.column,
        truncated: isTruncated,
      }),
    [
      breadcrumbBasePath,
      file.column,
      file.line,
      isTruncated,
      previewPathKind,
      resolvedPath,
    ],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <ChatSessionWorkspaceFileBreadcrumbs
        breadcrumb={breadcrumb}
        onFileOpen={onFileOpen}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {file.viewMode === "diff" ? (
          <WorkspaceDiffBody diffBlock={diffBlock} />
        ) : (
          <WorkspacePreviewBody
            contentUrl={contentUrl}
            contentUrlKind={contentUrlKind}
            contentLabel={file.label?.trim() || resolvedPath}
            directoryQuery={directoryQuery}
            onFileOpen={onFileOpen}
            previewBlock={previewBlock}
            previewKind={previewKind}
            previewQuery={previewQuery}
            previewText={previewText}
            previewUrl={previewUrl}
            previewViewer={previewViewer}
          />
        )}
      </div>
    </div>
  );
}
