import { useState } from "react";
import type {
  ChatFileOpenActionViewModel,
  ChatInlineDisplayViewModel,
} from "@nextclaw/agent-chat-ui";
import { Code2, FileText, PanelRightOpen } from "lucide-react";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import { ChatInlineContentSurface } from "@/features/chat/features/message/components/chat-inline-content-surface";
import { createWorkspaceFileTab } from "@/features/chat/features/workspace/utils/chat-workspace-file-tab.utils";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { t } from "@/shared/lib/i18n";

type ChatInlineFilePreviewProps = {
  display: ChatInlineDisplayViewModel;
  parentSessionKey: string | null;
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
};

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

  return isRenderedHtml ? (
    <ChatInlineContentSurface
      actions={
        <>
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
        </>
      }
      contentHeight={htmlContentHeight}
    >
      <ChatSessionWorkspaceFilePreview
        file={file}
        sessionProjectRoot={sessionProjectRoot}
        sessionWorkingDir={sessionWorkingDir}
        showBreadcrumbs={false}
        onHtmlContentHeightChange={setHtmlContentHeight}
        onFileOpen={onFileOpen}
      />
    </ChatInlineContentSurface>
  ) : (
    <section
      className="my-2 w-full max-w-[48rem] overflow-hidden rounded-lg border border-border bg-card shadow-sm"
      data-chat-inline-file-preview="true"
      data-chat-message-wide-content="true"
    >
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
      <div className="h-[420px] min-h-[240px] max-h-[min(60vh,420px)] overflow-hidden">
        <ChatSessionWorkspaceFilePreview
          file={file}
          sessionProjectRoot={sessionProjectRoot}
          sessionWorkingDir={sessionWorkingDir}
          showBreadcrumbs={false}
          onFileOpen={onFileOpen}
        />
      </div>
    </section>
  );
}
