import { useState } from "react";
import type {
  ChatFileOpenActionViewModel,
  ChatInlineDisplayViewModel,
} from "@nextclaw/agent-chat-ui";
import { Code2, FileText, PanelRightOpen } from "lucide-react";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import { createWorkspaceFileTab } from "@/features/chat/features/workspace/utils/chat-workspace-file-tab.utils";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type ChatInlineFilePreviewProps = {
  display: ChatInlineDisplayViewModel;
  parentSessionKey: string | null;
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
};

const INLINE_HTML_MIN_HEIGHT = 240;

export function ChatInlineFilePreview({
  display,
  parentSessionKey,
  sessionProjectRoot,
  sessionWorkingDir,
  onFileOpen,
}: ChatInlineFilePreviewProps) {
  const [htmlContentHeight, setHtmlContentHeight] = useState<number | null>(
    null,
  );
  if (display.target.type !== "file") {
    return null;
  }
  const { path, line, column, viewer } = display.target.payload;
  const file = createWorkspaceFileTab(
    {
      path,
      label: display.title,
      viewMode: "preview",
      previewViewer: viewer,
      line,
      column,
    },
    parentSessionKey,
  );
  if (!file) {
    return null;
  }
  const title =
    file.label ?? file.path.split(/[\\/]/).filter(Boolean).pop() ?? file.path;
  const isRenderedHtml =
    file.previewViewer === "rendered" && /\.html?$/i.test(file.path);
  const openInWorkspace = (previewViewer: "rendered" | "source") => {
    onFileOpen({
      path: file.path,
      label: file.label ?? undefined,
      viewMode: "preview",
      previewViewer,
      line: file.line ?? undefined,
      column: file.column ?? undefined,
    });
  };

  return (
    <section
      className={cn(
        "my-2 w-full max-w-[48rem]",
        isRenderedHtml
          ? "group/inline-html relative overflow-visible"
          : "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
      )}
      data-chat-inline-file-preview="true"
      data-chat-message-wide-content="true"
    >
      {isRenderedHtml ? (
        <div
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 pb-2 opacity-0 transition-opacity duration-150",
            "group-hover/inline-html:pointer-events-auto group-hover/inline-html:opacity-100 group-focus-within/inline-html:pointer-events-auto group-focus-within/inline-html:opacity-100",
          )}
          data-chat-inline-file-actions="true"
        >
          <div
            className="flex items-center gap-0.5 rounded-lg bg-background/95 p-0.5 shadow-md ring-1 ring-border/60 backdrop-blur-sm"
            data-chat-inline-file-actions-surface="true"
          >
            <IconActionButton
              size="sm"
              icon={<PanelRightOpen className="h-3.5 w-3.5" />}
              label={t("chatPanelCardExpand")}
              tooltipSide="top"
              onClick={() => openInWorkspace("rendered")}
            />
            <IconActionButton
              size="sm"
              icon={<Code2 className="h-3.5 w-3.5" />}
              label={t("chatWorkspaceOpenSource")}
              tooltipSide="top"
              onClick={() => openInWorkspace("source")}
            />
          </div>
        </div>
      ) : (
        <header className="border-b border-border bg-muted/45 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
            <FileText
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">{title}</span>
          </div>
          <p
            className="mt-1 truncate font-mono text-[11px] font-normal text-muted-foreground"
            title={file.path}
          >
            {file.path}
          </p>
        </header>
      )}
      <div
        className={cn(
          "min-h-[240px] overflow-hidden",
          isRenderedHtml
            ? "h-[240px] max-h-[min(80vh,720px)] rounded-lg"
            : "h-[420px] max-h-[min(60vh,420px)]",
        )}
        data-chat-inline-file-viewport="true"
        style={
          isRenderedHtml && htmlContentHeight
            ? { height: Math.max(INLINE_HTML_MIN_HEIGHT, htmlContentHeight) }
            : undefined
        }
      >
        <ChatSessionWorkspaceFilePreview
          file={file}
          sessionProjectRoot={sessionProjectRoot}
          sessionWorkingDir={sessionWorkingDir}
          showBreadcrumbs={false}
          onHtmlContentHeightChange={
            isRenderedHtml ? setHtmlContentHeight : undefined
          }
          onFileOpen={onFileOpen}
        />
      </div>
    </section>
  );
}
