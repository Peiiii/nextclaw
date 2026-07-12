import type { ReactNode } from "react";
import type { ChatFileOpenActionViewModel } from "@nextclaw/agent-chat-ui";
import { ChevronRight, FileCode2, Folder } from "lucide-react";
import type { useServerPathBrowse } from "@/shared/hooks/use-server-path-browse";
import type { ServerPathEntryView } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type ChatSessionWorkspaceDirectoryBrowserProps = {
  browseQuery: ReturnType<typeof useServerPathBrowse>;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  renderStatus: (params: {
    text: string;
    tone?: "muted" | "error";
  }) => ReactNode;
};

function WorkspaceDirectoryEntryIcon({
  kind,
}: {
  kind: ServerPathEntryView["kind"];
}) {
  return kind === "directory" ? (
    <Folder className="h-4 w-4 shrink-0 text-emerald-600" />
  ) : (
    <FileCode2 className="h-4 w-4 shrink-0 text-sky-600" />
  );
}

function buildDirectoryEntryLabel(entry: ServerPathEntryView): string {
  const actionLabel =
    entry.kind === "directory"
      ? t("chatWorkspaceOpenDirectory")
      : t("chatWorkspaceOpenFile");
  return `${actionLabel}: ${entry.name}`;
}

export function ChatSessionWorkspaceDirectoryBrowser({
  browseQuery,
  onFileOpen,
  renderStatus,
}: ChatSessionWorkspaceDirectoryBrowserProps) {
  const entries = browseQuery.data?.entries ?? [];
  const errorMessage = browseQuery.error
    ? browseQuery.error instanceof Error
      ? browseQuery.error.message
      : String(browseQuery.error)
    : null;
  const openEntry = (entry: ServerPathEntryView) => {
    onFileOpen({
      path: entry.path,
      label: entry.name,
      viewMode: "preview",
    });
  };

  if (browseQuery.isLoading && !browseQuery.data) {
    return renderStatus({ text: t("chatWorkspaceLoadingDirectory") });
  }

  if (errorMessage && !browseQuery.data) {
    return renderStatus({
      tone: "error",
      text: `${t("chatWorkspaceDirectoryLoadFailed")}: ${errorMessage}`,
    });
  }

  if (entries.length === 0) {
    return renderStatus({ text: t("chatWorkspaceDirectoryEmpty") });
  }

  return (
    <div
      data-testid="workspace-directory-browser"
      className="h-full overflow-auto bg-white px-2 py-2 custom-scrollbar"
    >
      <div className="space-y-0.5">
        {entries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            aria-label={buildDirectoryEntryLabel(entry)}
            className={cn(
              "flex h-8 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
              entry.hidden ? "opacity-65" : null,
            )}
            onClick={() => openEntry(entry)}
          >
            <WorkspaceDirectoryEntryIcon kind={entry.kind} />
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            {entry.kind === "directory" ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
