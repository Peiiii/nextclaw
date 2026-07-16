import { useEffect, useRef } from "react";
import { WorkspaceDocxPreview } from "./file-content-preview/workspace-docx-preview";
import { WorkspacePresentationPreview } from "./file-content-preview/workspace-presentation-preview";
import { WorkspaceSpreadsheetPreview } from "./file-content-preview/workspace-spreadsheet-preview";
import { t } from "@/shared/lib/i18n";

export type WorkspaceFileContentKind =
  | "image"
  | "audio"
  | "video"
  | "pdf"
  | "html"
  | "docx"
  | "spreadsheet"
  | "presentation"
  | "other";

export function resolveWorkspaceFileContentKind(params: {
  path: string;
  mimeType?: string | null;
}): WorkspaceFileContentKind {
  const mime = params.mimeType?.trim().toLowerCase() ?? "";
  const path = params.path.trim().toLowerCase();
  if (
    mime.startsWith("image/") ||
    /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i.test(path)
  ) {
    return "image";
  }
  if (
    mime.startsWith("audio/") ||
    /\.(aac|flac|m4a|mp3|ogg|opus|wav|weba)$/i.test(path)
  ) {
    return "audio";
  }
  if (
    mime.startsWith("video/") ||
    /\.(avi|m4v|mkv|mov|mp4|webm|wmv)$/i.test(path)
  ) {
    return "video";
  }
  if (mime.includes("pdf") || path.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    path.endsWith(".docx")
  ) {
    return "docx";
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    /\.(ods|xls|xlsb|xlsm|xlsx)$/i.test(path)
  ) {
    return "spreadsheet";
  }
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    path.endsWith(".pptx")
  ) {
    return "presentation";
  }
  if (mime.includes("html") || /\.html?$/i.test(path)) {
    return "html";
  }
  return "other";
}

function WorkspaceUnsupportedContent({
  contentUrl,
  label,
}: {
  contentUrl: string;
  label: string;
}) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
      data-testid="workspace-content-unsupported"
    >
      <div className="max-w-sm space-y-1.5">
        <p
          className="truncate text-sm font-medium text-foreground"
          title={label}
        >
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

function readHtmlDocumentHeight(document: Document): number {
  const { body, documentElement } = document;
  return Math.ceil(
    Math.max(
      body?.clientHeight ?? 0,
      body?.offsetHeight ?? 0,
      body?.scrollHeight ?? 0,
      documentElement.clientHeight,
      documentElement.offsetHeight,
      documentElement.scrollHeight,
    ),
  );
}

function WorkspaceHtmlPreview({
  contentUrl,
  label,
  onContentHeightChange,
}: {
  contentUrl: string;
  label: string;
  onContentHeightChange?: (height: number) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      observerCleanupRef.current?.();
    },
    [],
  );

  const observeContentHeight = () => {
    observerCleanupRef.current?.();
    observerCleanupRef.current = null;
    const iframe = iframeRef.current;
    if (
      !iframe ||
      !onContentHeightChange ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }

    try {
      const document = iframe.contentDocument;
      if (!document) {
        return;
      }
      const reportHeight = () => {
        const height = readHtmlDocumentHeight(document);
        if (height > 0) {
          onContentHeightChange(height);
        }
      };
      const observer = new ResizeObserver(reportHeight);
      observer.observe(document.documentElement);
      if (document.body) {
        observer.observe(document.body);
      }
      reportHeight();
      observerCleanupRef.current = () => observer.disconnect();
    } catch {
      // Cross-origin documents keep the caller's bounded fallback height.
    }
  };

  return (
    <iframe
      ref={iframeRef}
      allowFullScreen
      className="h-full w-full border-0 bg-white"
      data-testid="workspace-html-preview"
      src={contentUrl}
      title={label}
      onLoad={observeContentHeight}
    />
  );
}

export function WorkspaceFileContentPreview({
  contentUrl,
  kind,
  label,
  onHtmlContentHeightChange,
}: {
  contentUrl: string;
  kind: WorkspaceFileContentKind;
  label: string;
  onHtmlContentHeightChange?: (height: number) => void;
}) {
  if (kind === "image") {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-white p-4 custom-scrollbar">
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
  if (kind === "html") {
    return (
      <WorkspaceHtmlPreview
        contentUrl={contentUrl}
        label={label}
        onContentHeightChange={onHtmlContentHeightChange}
      />
    );
  }
  if (kind === "pdf") {
    return (
      <iframe
        allowFullScreen
        className="h-full w-full border-0 bg-white"
        data-testid="workspace-content-pdf"
        src={contentUrl}
        title={label}
      />
    );
  }
  if (kind === "docx") {
    return <WorkspaceDocxPreview contentUrl={contentUrl} />;
  }
  if (kind === "spreadsheet") {
    return <WorkspaceSpreadsheetPreview contentUrl={contentUrl} />;
  }
  if (kind === "presentation") {
    return <WorkspacePresentationPreview contentUrl={contentUrl} />;
  }
  return <WorkspaceUnsupportedContent contentUrl={contentUrl} label={label} />;
}
