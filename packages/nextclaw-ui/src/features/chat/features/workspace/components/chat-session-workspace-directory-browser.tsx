import { useState, type ReactNode } from "react";
import type { ChatFileOpenActionViewModel } from "@nextclaw/agent-chat-ui";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useServerPathBrowse } from "@/shared/hooks/use-server-path-browse";
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
  showRoot?: boolean;
};

function buildDirectoryEntryLabel(entry: ServerPathEntryView): string {
  const actionLabel =
    entry.kind === "directory"
      ? t("chatWorkspaceOpenDirectory")
      : t("chatWorkspaceOpenFile");
  return `${actionLabel}: ${entry.name}`;
}

function readPathName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function readBrowseError(
  browseQuery: ReturnType<typeof useServerPathBrowse>,
): string | null {
  if (!browseQuery.error) {
    return null;
  }
  return browseQuery.error instanceof Error
    ? browseQuery.error.message
    : String(browseQuery.error);
}

function WorkspaceDirectoryEntryIcon({
  isDirectory,
  isExpanded,
}: {
  isDirectory: boolean;
  isExpanded: boolean;
}) {
  if (!isDirectory) {
    return <FileCode2 className="h-4 w-4 shrink-0 text-sky-600" />;
  }
  return isExpanded ? (
    <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
  ) : (
    <Folder className="h-4 w-4 shrink-0 text-amber-500" />
  );
}

function WorkspaceDirectoryTreeChildren({
  browseQuery,
  level,
  onFileOpen,
}: {
  browseQuery: ReturnType<typeof useServerPathBrowse>;
  level: number;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
}) {
  const entries = browseQuery.data?.entries ?? [];
  const errorMessage = readBrowseError(browseQuery);
  const statusStyle = { paddingLeft: `${36 + level * 14}px` };

  if (browseQuery.isLoading && !browseQuery.data) {
    return (
      <div
        className="h-7 truncate pr-2 text-[11px] leading-7 text-gray-400"
        style={statusStyle}
      >
        {t("chatWorkspaceLoadingDirectory")}
      </div>
    );
  }
  if (errorMessage && !browseQuery.data) {
    return (
      <div
        className="h-7 truncate pr-2 text-[11px] leading-7 text-rose-600"
        style={statusStyle}
        title={errorMessage}
      >
        {t("chatWorkspaceDirectoryLoadFailed")}
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div
        className="h-7 truncate pr-2 text-[11px] leading-7 text-gray-400"
        style={statusStyle}
      >
        {t("chatWorkspaceDirectoryEmpty")}
      </div>
    );
  }
  return entries.map((entry) => (
    <WorkspaceDirectoryTreeEntry
      key={entry.path}
      entry={entry}
      level={level + 1}
      onFileOpen={onFileOpen}
    />
  ));
}

function WorkspaceDirectoryTreeEntry({
  entry,
  level,
  onFileOpen,
}: {
  entry: ServerPathEntryView;
  level: number;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
}) {
  const isDirectory = entry.kind === "directory";
  const [isExpanded, setIsExpanded] = useState(false);
  const browseQuery = useServerPathBrowse({
    path: entry.path,
    includeFiles: true,
    enabled: isDirectory && isExpanded,
  });
  const activateEntry = () => {
    if (isDirectory) {
      setIsExpanded((value) => !value);
      return;
    }
    onFileOpen({
      path: entry.path,
      label: entry.name,
      viewMode: "preview",
    });
  };

  return (
    <div
      role="treeitem"
      aria-expanded={isDirectory ? isExpanded : undefined}
      aria-label={buildDirectoryEntryLabel(entry)}
    >
      <button
        type="button"
        className={cn(
          "flex h-7 w-full min-w-0 items-center gap-1.5 pr-2 text-left text-[13px] text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border",
          entry.hidden ? "opacity-65" : null,
        )}
        style={{ paddingLeft: `${8 + level * 14}px` }}
        onClick={activateEntry}
      >
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">
          {isDirectory ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : null}
        </span>
        <WorkspaceDirectoryEntryIcon
          isDirectory={isDirectory}
          isExpanded={isExpanded}
        />
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      </button>

      {isDirectory && isExpanded ? (
        <div role="group">
          <WorkspaceDirectoryTreeChildren
            browseQuery={browseQuery}
            level={level}
            onFileOpen={onFileOpen}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ChatSessionWorkspaceDirectoryBrowser({
  browseQuery,
  onFileOpen,
  renderStatus,
  showRoot = false,
}: ChatSessionWorkspaceDirectoryBrowserProps) {
  const entries = browseQuery.data?.entries ?? [];
  const errorMessage = readBrowseError(browseQuery);

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
      role="tree"
      aria-label={t("chatWorkspaceProjectFiles")}
      className="h-full overflow-auto bg-white py-2 custom-scrollbar"
    >
      {showRoot && browseQuery.data ? (
        <div role="treeitem" aria-expanded="true">
          <div className="flex h-8 items-center gap-1.5 border-b border-gray-100 px-2 text-xs font-semibold text-gray-700">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 truncate" title={browseQuery.data.currentPath}>
              {readPathName(browseQuery.data.currentPath)}
            </span>
          </div>
          <div role="group" className="pt-1">
            {entries.map((entry) => (
              <WorkspaceDirectoryTreeEntry
                key={entry.path}
                entry={entry}
                level={1}
                onFileOpen={onFileOpen}
              />
            ))}
          </div>
        </div>
      ) : (
        entries.map((entry) => (
          <WorkspaceDirectoryTreeEntry
            key={entry.path}
            entry={entry}
            level={0}
            onFileOpen={onFileOpen}
          />
        ))
      )}
    </div>
  );
}
