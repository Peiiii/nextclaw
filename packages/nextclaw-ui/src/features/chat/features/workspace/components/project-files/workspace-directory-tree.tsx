import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChatFileOpenActionViewModel } from '@nextclaw/agent-chat-ui';
import {
  ChevronDown,
  ChevronRight,
  Check,
  Folder,
  FolderOpen,
  MoreHorizontal,
  X,
} from 'lucide-react';
import type {
  RefreshDirectory,
  WorkspaceDirectoryActionTarget,
  WorkspaceTreeSelection,
} from '@/features/chat/features/workspace/hooks/use-workspace-file-actions';
import { FileTypeIcon } from '@/shared/components/file-type-icon';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Input } from '@/shared/components/ui/input';
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu/context-menu';
import { useServerPathBrowse } from '@/shared/hooks/use-server-path-browse';
import { buildServerPathContentUrl, type ServerPathEntryView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import { buildWorkspaceEntryContextMenuGroups } from '@/features/chat/features/workspace/components/project-files/workspace-directory-entry-menu';

export { copyWorkspacePath } from '@/features/chat/features/workspace/components/project-files/workspace-directory-entry-menu';

type WorkspaceDirectoryTreeActionProps = {
  busy: boolean;
  collapseVersion: number;
  createTarget: WorkspaceDirectoryActionTarget | null;
  onAddToChat?: (entry: ServerPathEntryView, relativePath: string) => void;
  onCreateFolder?: (target: WorkspaceDirectoryActionTarget) => void;
  onCreateFile?: (target: WorkspaceDirectoryActionTarget) => void;
  onDelete?: (entry: ServerPathEntryView, refresh: RefreshDirectory) => void;
  onRename?: (entry: ServerPathEntryView, name: string, refresh: RefreshDirectory) => Promise<unknown>;
  onRevealComplete: () => void;
  onSelect: (selection: WorkspaceTreeSelection) => void;
  onUpload?: (target: WorkspaceDirectoryActionTarget) => void;
  renderCreateFolder: (level: number) => ReactNode;
  revealPath: string | null;
  selectedPath: string | null;
};

function buildEntryLabel(entry: ServerPathEntryView): string {
  const actionLabel = entry.kind === 'directory' ? t('chatWorkspaceOpenDirectory') : t('chatWorkspaceOpenFile');
  return `${actionLabel}: ${entry.name}`;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function readBrowseError(browseQuery: ReturnType<typeof useServerPathBrowse>): string | null {
  return browseQuery.error ? readErrorMessage(browseQuery.error) : null;
}

function EntryIcon({
  fileName,
  isDirectory,
  isExpanded,
}: {
  fileName: string;
  isDirectory: boolean;
  isExpanded: boolean;
}) {
  if (!isDirectory) {
    return <FileTypeIcon fileName={fileName} />;
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
  onRevealPath,
  parentCreateTarget,
  parentRelativePath,
  ...actions
}: WorkspaceDirectoryTreeActionProps & {
  browseQuery: ReturnType<typeof useServerPathBrowse>;
  level: number;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  onRevealPath?: (path: string) => void;
  parentCreateTarget: WorkspaceDirectoryActionTarget;
  parentRelativePath: string | null;
}) {
  const entries = browseQuery.data?.entries ?? [];
  const errorMessage = readBrowseError(browseQuery);
  const statusStyle = { paddingLeft: `${36 + level * 14}px` };

  if (browseQuery.isLoading && !browseQuery.data) {
    return (
      <div className="h-7 truncate pr-2 text-[11px] leading-7 text-gray-400" style={statusStyle}>
        {t('chatWorkspaceLoadingDirectory')}
      </div>
    );
  }
  if (errorMessage && !browseQuery.data) {
    return (
      <div className="h-7 truncate pr-2 text-[11px] leading-7 text-rose-600" style={statusStyle} title={errorMessage}>
        {t('chatWorkspaceDirectoryLoadFailed')}
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="h-7 truncate pr-2 text-[11px] leading-7 text-gray-400" style={statusStyle}>
        {t('chatWorkspaceDirectoryEmpty')}
      </div>
    );
  }
  return entries.map((entry) => (
    <WorkspaceDirectoryTreeEntry
      key={entry.path}
      {...actions}
      browseParentRefresh={() => browseQuery.refetch()}
      entry={entry}
      level={level + 1}
      onFileOpen={onFileOpen}
      onRevealPath={onRevealPath}
      parentCreateTarget={parentCreateTarget}
      relativePath={parentRelativePath ? `${parentRelativePath}/${entry.name}` : null}
    />
  ));
}

function useWorkspaceEntryRename({
  entry,
  onRename,
  refresh,
}: {
  entry: ServerPathEntryView;
  onRename?: WorkspaceDirectoryTreeActionProps['onRename'];
  refresh: RefreshDirectory;
}) {
  const [active, setActive] = useState(false);
  const [name, setName] = useState(entry.name);
  const [error, setError] = useState<string | null>(null);
  const cancel = () => setActive(false);
  const start = () => {
    setName(entry.name);
    setError(null);
    setActive(true);
  };
  const updateName = (value: string) => {
    setName(value);
    setError(null);
  };
  const submit = async () => {
    const normalizedName = name.trim();
    if (
      !onRename ||
      !normalizedName ||
      normalizedName === '.' ||
      normalizedName === '..' ||
      normalizedName.includes('/') ||
      normalizedName.includes('\\')
    ) {
      return;
    }
    if (normalizedName === entry.name) {
      cancel();
      return;
    }
    try {
      await onRename(entry, normalizedName, refresh);
      cancel();
    } catch (renameError) {
      setError(`${t('chatWorkspaceRenameFailed')}: ${readErrorMessage(renameError)}`);
    }
  };
  return { active, cancel, error, name, start, submit, updateName };
}

export function WorkspaceDirectoryTreeEntry({
  browseParentRefresh,
  busy,
  collapseVersion,
  createTarget,
  entry,
  level,
  onAddToChat,
  onCreateFolder,
  onCreateFile,
  onDelete,
  onRename,
  onFileOpen,
  onRevealComplete,
  onRevealPath,
  onSelect,
  onUpload,
  parentCreateTarget,
  relativePath,
  renderCreateFolder,
  revealPath,
  selectedPath,
}: WorkspaceDirectoryTreeActionProps & {
  browseParentRefresh: RefreshDirectory;
  entry: ServerPathEntryView;
  level: number;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  onRevealPath?: (path: string) => void;
  parentCreateTarget: WorkspaceDirectoryActionTarget;
  relativePath: string | null;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const entryButtonRef = useRef<HTMLButtonElement | null>(null);
  const isDirectory = entry.kind === 'directory';
  const [isExpanded, setIsExpanded] = useState(false);
  const rename = useWorkspaceEntryRename({
    entry,
    onRename,
    refresh: browseParentRefresh,
  });
  useEffect(() => {
    if (collapseVersion > 0) setIsExpanded(false);
  }, [collapseVersion]);
  const browseQuery = useServerPathBrowse({
    path: entry.path,
    includeFiles: true,
    enabled: isDirectory && isExpanded,
  });
  const refreshDirectory = browseQuery.refetch;
  const downloadUrl = isDirectory ? null : buildServerPathContentUrl(entry.path);
  const ownCreateTarget = useMemo<WorkspaceDirectoryActionTarget>(
    () =>
      isDirectory
        ? {
            label: entry.name,
            path: entry.path,
            refresh: () => refreshDirectory(),
            expand: () => setIsExpanded(true),
          }
        : parentCreateTarget,
    [entry.name, entry.path, isDirectory, parentCreateTarget, refreshDirectory],
  );
  const selection = useMemo<WorkspaceTreeSelection>(
    () => ({ path: entry.path, createTarget: ownCreateTarget }),
    [entry.path, ownCreateTarget],
  );

  useLayoutEffect(() => {
    if (revealPath !== entry.path) return;
    rowRef.current?.scrollIntoView?.({ block: 'nearest' });
    onSelect(selection);
    entryButtonRef.current?.focus();
    onRevealComplete();
  }, [entry.path, onRevealComplete, onSelect, revealPath, selection]);

  const activateEntry = () => {
    onSelect(selection);
    if (isDirectory) setIsExpanded((value) => !value);
    else onFileOpen({ path: entry.path, label: entry.name, viewMode: 'preview' });
  };

  const contextMenuGroups = buildWorkspaceEntryContextMenuGroups({
    busy,
    downloadUrl,
    entry,
    onAddToChat,
    onCreateFolder,
    onCreateFile,
    onDelete,
    onOpen: activateEntry,
    onRenameRequest: onRename ? rename.start : undefined,
    onRevealPath,
    onUpload,
    ownCreateTarget,
    parentRefresh: browseParentRefresh,
    relativePath,
  });
  return (
    <div role="treeitem" aria-expanded={isDirectory ? isExpanded : undefined} aria-label={buildEntryLabel(entry)}>
      <ContextMenu groups={contextMenuGroups} label={t('chatWorkspaceFileContextMenu')}>
        <div
          ref={rowRef}
          data-workspace-tree-entry=""
          className={cn(
            'group flex h-[26px] w-full min-w-0 items-center text-gray-700 transition-colors hover:bg-gray-100 focus-within:bg-gray-100',
            selectedPath === entry.path ? 'bg-primary/10' : null,
            entry.hidden ? 'opacity-65' : null,
          )}
          style={{ paddingLeft: `${6 + level * 12}px` }}
          onContextMenu={() => onSelect(selection)}
        >
          {rename.active ? (
            <form
              className="flex h-full min-w-0 flex-1 items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                void rename.submit();
              }}
            >
              <Input
                autoFocus
                aria-label={t('chatWorkspaceRenameName')}
                className="h-6 min-w-0 flex-1 px-1.5 text-xs"
                value={rename.name}
                onChange={(event) => rename.updateName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    rename.cancel();
                  }
                }}
              />
              <IconActionButton
                icon={<Check className="h-3.5 w-3.5" />}
                label={t('chatWorkspaceRename')}
                size="sm"
                onClick={() => void rename.submit()}
              />
              <IconActionButton
                icon={<X className="h-3.5 w-3.5" />}
                label={t('cancel')}
                size="sm"
                onClick={rename.cancel}
              />
            </form>
          ) : (
            <button
              ref={entryButtonRef}
              type="button"
              aria-label={entry.name}
              className="flex h-full min-w-0 flex-1 items-center gap-1 text-left text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border"
              onClick={activateEntry}
              onKeyDown={(event) => {
                if (event.key === 'F2' && onRename) {
                  event.preventDefault();
                  rename.start();
                }
              }}
            >
              <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-gray-400">
                {isDirectory ? (
                  isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )
                ) : null}
              </span>
              <EntryIcon fileName={entry.name} isDirectory={isDirectory} isExpanded={isExpanded} />
              <span className="min-w-0 flex-1 truncate" title={entry.name}>
                {entry.name}
              </span>
            </button>
          )}
          {!rename.active ? (
            <ContextMenuTrigger>
              <IconActionButton
                className="mr-1 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 data-[context-menu-open]:pointer-events-auto data-[context-menu-open]:opacity-100"
                icon={<MoreHorizontal className="h-3.5 w-3.5" />}
                label={t('chatWorkspaceMoreActionsFor').replace('{name}', entry.name)}
                size="sm"
                tooltipSide="left"
                onClick={() => onSelect(selection)}
              />
            </ContextMenuTrigger>
          ) : null}
        </div>
      </ContextMenu>
      {rename.error ? (
        <p
          role="alert"
          className="py-1 pr-2 text-[11px] text-destructive"
          style={{ paddingLeft: `${36 + level * 14}px` }}
        >
          {rename.error}
        </p>
      ) : null}
      {isDirectory && isExpanded ? (
        <div role="group">
          {createTarget?.path === entry.path ? renderCreateFolder(level + 1) : null}
          <WorkspaceDirectoryTreeChildren
            browseQuery={browseQuery}
            busy={busy}
            collapseVersion={collapseVersion}
            createTarget={createTarget}
            level={level}
            onAddToChat={onAddToChat}
            onCreateFolder={onCreateFolder}
            onCreateFile={onCreateFile}
            onDelete={onDelete}
            onRename={onRename}
            onFileOpen={onFileOpen}
            onRevealComplete={onRevealComplete}
            onRevealPath={onRevealPath}
            onSelect={onSelect}
            onUpload={onUpload}
            parentCreateTarget={ownCreateTarget}
            parentRelativePath={relativePath}
            renderCreateFolder={renderCreateFolder}
            revealPath={revealPath}
            selectedPath={selectedPath}
          />
        </div>
      ) : null}
    </div>
  );
}
