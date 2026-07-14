import type {
  ChatFileOpenActionViewModel,
  ChatInlineDisplayViewModel,
} from "@nextclaw/agent-chat-ui";
import { FileText } from "lucide-react";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import { createWorkspaceFileTab } from "@/features/chat/features/workspace/utils/chat-workspace-file-tab.utils";

type ChatInlineFilePreviewProps = {
  display: ChatInlineDisplayViewModel;
  parentSessionKey: string | null;
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
};

function readFileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export function ChatInlineFilePreview({
  display,
  parentSessionKey,
  sessionProjectRoot,
  sessionWorkingDir,
  onFileOpen,
}: ChatInlineFilePreviewProps) {
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
  const title = display.title ?? readFileName(file.path);

  return (
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
