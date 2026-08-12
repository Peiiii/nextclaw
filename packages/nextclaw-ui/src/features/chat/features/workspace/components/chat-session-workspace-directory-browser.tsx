import { useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatFileOpenActionViewModel } from '@nextclaw/agent-chat-ui';
import { ChevronsUp, Copy, FilePlus2, FolderPlus, LocateFixed, Upload, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import {
  copyWorkspacePath,
  readBrowseError,
  WorkspaceDirectoryTreeEntry,
} from '@/features/chat/features/workspace/components/project-files/workspace-directory-tree';
import { WorkspaceNewFolderTreeItem } from '@/features/chat/features/workspace/components/project-files/workspace-new-folder-tree-item';
import { WorkspaceProjectFilesToolbar } from '@/features/chat/features/workspace/components/project-files/workspace-project-files-toolbar';
import {
  isWorkspaceProjectBrowseQuery,
  WorkspaceProjectTree,
} from '@/features/chat/features/workspace/components/project-files/workspace-project-tree-view';
import {
  useWorkspaceProjectFilesController,
  type RefreshDirectory,
  type WorkspaceDirectoryActionTarget,
  type WorkspaceTreeSelection,
} from '@/features/chat/features/workspace/hooks/use-workspace-file-actions';
import { ContextMenu, type ContextMenuGroup } from '@/shared/components/ui/context-menu/context-menu';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { useServerPathWatch } from '@/shared/hooks/use-server-path-watch';
import type { useServerPathBrowse } from '@/shared/hooks/use-server-path-browse';
import type { ServerPathEntryView } from '@/shared/lib/api';
import { hostCapabilityManager } from '@/shared/lib/host-capabilities';
import { t } from '@/shared/lib/i18n';
import {
  normalizeWorkspaceProjectTreeRootKey,
  useWorkspaceProjectTreeStore,
} from '@/features/chat/features/workspace/stores/workspace-project-tree.store';

type ChatSessionWorkspaceDirectoryBrowserProps = {
  activeRelativePath?: string | null;
  browseQuery: ReturnType<typeof useServerPathBrowse>;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  sessionKey?: string | null;
  renderStatus: (params: { text: string; tone?: 'muted' | 'error' }) => ReactNode;
  showRoot?: boolean;
};

const EMPTY_EXPANDED_PATHS: readonly string[] = [];

function readPathName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function WorkspaceDirectoryEntries({
  activeRelativePath,
  busy,
  createTarget,
  entries,
  fallbackParentTarget,
  mutable,
  onAddToChat,
  onCreateFile,
  onCreateFolder,
  onDelete,
  onFileOpen,
  onRevealComplete,
  onRename,
  onRevealPath,
  onSelect,
  onUpload,
  refresh,
  relativePaths,
  renderCreateFolder,
  revealPath,
  selectedPath,
  showRoot,
  treeRootKey,
}: {
  activeRelativePath: string | null;
  busy: boolean;
  createTarget: WorkspaceDirectoryActionTarget | null;
  entries: readonly ServerPathEntryView[];
  fallbackParentTarget: WorkspaceDirectoryActionTarget;
  mutable: boolean;
  onAddToChat?: (entry: ServerPathEntryView, relativePath: string) => void;
  onCreateFile: (target: WorkspaceDirectoryActionTarget) => void;
  onCreateFolder: (target: WorkspaceDirectoryActionTarget) => void;
  onDelete: (entry: ServerPathEntryView, refresh: RefreshDirectory) => void;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  onRevealComplete: () => void;
  onRename: (entry: ServerPathEntryView, name: string, refresh: RefreshDirectory) => Promise<unknown>;
  onRevealPath?: (path: string) => void;
  onSelect: (selection: WorkspaceTreeSelection) => void;
  onUpload: (target: WorkspaceDirectoryActionTarget) => void;
  refresh: RefreshDirectory;
  relativePaths: boolean;
  renderCreateFolder: (level: number) => ReactNode;
  revealPath: string | null;
  selectedPath: string | null;
  showRoot: boolean;
  treeRootKey: string | null;
}) {
  if (entries.length === 0) {
    return <div className="px-4 py-8 text-center text-xs text-gray-400">{t('chatWorkspaceDirectoryEmpty')}</div>;
  }
  return entries.map((entry) => (
    <WorkspaceDirectoryTreeEntry
      activeRelativePath={activeRelativePath}
      key={entry.path}
      browseParentRefresh={refresh}
      busy={busy}
      createTarget={createTarget}
      entry={entry}
      level={showRoot ? 1 : 0}
      onAddToChat={onAddToChat}
      onCreateFile={mutable ? onCreateFile : undefined}
      onCreateFolder={mutable ? onCreateFolder : undefined}
      onDelete={mutable ? onDelete : undefined}
      onFileOpen={onFileOpen}
      onRevealComplete={onRevealComplete}
      onRename={onRename}
      onRevealPath={onRevealPath}
      onSelect={onSelect}
      onUpload={mutable ? onUpload : undefined}
      parentCreateTarget={fallbackParentTarget}
      relativePath={relativePaths ? entry.name : null}
      renderCreateFolder={renderCreateFolder}
      revealPath={revealPath}
      selectedPath={selectedPath}
      treeRootKey={treeRootKey}
    />
  ));
}

function buildRootContextMenuGroups({
  busy,
  onCollapseAll,
  onCreateFile,
  onCreateFolder,
  onRefresh,
  onRevealPath,
  onUpload,
  target,
}: {
  busy: boolean;
  onCollapseAll: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRefresh: () => void;
  onRevealPath?: (path: string) => void;
  onUpload: () => void;
  target: WorkspaceDirectoryActionTarget;
}): ContextMenuGroup[] {
  return [
    {
      key: 'manage',
      items: [
        {
          key: 'new-file',
          label: t('chatWorkspaceNewFile'),
          icon: <FilePlus2 className="h-4 w-4" />,
          disabled: busy,
          restoreFocus: false,
          onSelect: onCreateFile,
        },
        {
          key: 'new-folder',
          label: t('chatWorkspaceNewFolder'),
          icon: <FolderPlus className="h-4 w-4" />,
          disabled: busy,
          restoreFocus: false,
          onSelect: onCreateFolder,
        },
        {
          key: 'upload',
          label: t('chatWorkspaceUploadFilesHere'),
          icon: <Upload className="h-4 w-4" />,
          disabled: busy,
          restoreFocus: false,
          onSelect: onUpload,
        },
      ],
    },
    {
      key: 'view',
      items: [
        {
          key: 'refresh',
          label: t('chatWorkspaceRefreshExplorer'),
          icon: <RefreshCw className="h-4 w-4" />,
          onSelect: onRefresh,
        },
        {
          key: 'collapse',
          label: t('chatWorkspaceCollapseAll'),
          icon: <ChevronsUp className="h-4 w-4" />,
          onSelect: onCollapseAll,
        },
      ],
    },
    {
      key: 'path',
      items: [
        ...(onRevealPath
          ? [
              {
                key: 'reveal',
                label: t('chatWorkspaceRevealInFileManager'),
                icon: <LocateFixed className="h-4 w-4" />,
                onSelect: () => onRevealPath(target.path),
              },
            ]
          : []),
        {
          key: 'copy-path',
          label: t('chatWorkspaceCopyPath'),
          icon: <Copy className="h-4 w-4" />,
          onSelect: () => void copyWorkspacePath(target.path),
        },
      ],
    },
  ];
}

function WorkspaceDirectoryBrowserReady({
  activeRelativePath,
  browseQuery,
  ConfirmDialog,
  controller,
  entries,
  onAddToChat,
  onFileOpen,
  onRevealPath,
  rootLabel,
  rootPath,
  showRoot,
}: {
  activeRelativePath: string | null;
  browseQuery: ReturnType<typeof useServerPathBrowse>;
  ConfirmDialog: () => ReactNode;
  controller: ReturnType<typeof useWorkspaceProjectFilesController>;
  entries: readonly ServerPathEntryView[];
  onAddToChat?: (entry: ServerPathEntryView, relativePath: string) => void;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  onRevealPath?: (path: string) => void;
  rootLabel: string;
  rootPath: string | null;
  showRoot: boolean;
}) {
  const queryClient = useQueryClient();
  const {
    cancelCreateFolder,
    clearSelection,
    completeReveal,
    submitCreate,
    deleteEntry,
    openCreateFile,
    openCreateFolder,
    requestUpload,
    renameEntry,
    selectEntry,
    setCreateError,
    setCreateName,
    uploadFiles,
  } = controller.actions;
  const { fileInputRef } = controller.refs;
  const {
    createError,
    createKind,
    createName,
    createTarget,
    pendingAction,
    revealPath,
    selectedCreateTarget,
    selectedPath,
  } = controller.state;
  const busy = pendingAction !== null;
  const treeRootKey = normalizeWorkspaceProjectTreeRootKey(rootPath);
  const collapseAll = useWorkspaceProjectTreeStore((state) => state.collapseAll);
  const rootRefresh = () =>
    rootPath
      ? queryClient.refetchQueries({
          predicate: (query) => isWorkspaceProjectBrowseQuery(query.queryKey, rootPath),
          type: 'active',
        })
      : browseQuery.refetch();
  const rootTarget: WorkspaceDirectoryActionTarget | null = rootPath
    ? { label: rootLabel, path: rootPath, refresh: rootRefresh }
    : null;
  const toolbarTarget = selectedCreateTarget ?? rootTarget;
  const renderCreateFolder = (level: number) => (
    <WorkspaceNewFolderTreeItem
      error={createError}
      kind={createKind}
      isCreating={pendingAction === 'create-directory' || pendingAction === 'create-file'}
      level={level}
      name={createName}
      onCancel={cancelCreateFolder}
      onNameChange={(name) => {
        setCreateName(name);
        setCreateError(null);
      }}
      onSubmit={() => void submitCreate()}
    />
  );
  const fallbackParentTarget = rootTarget ?? {
    label: '',
    path: browseQuery.data?.currentPath ?? '',
    refresh: rootRefresh,
  };
  const treeEntries = (
    <WorkspaceDirectoryEntries
      activeRelativePath={activeRelativePath}
      busy={busy}
      createTarget={createTarget}
      entries={entries}
      fallbackParentTarget={fallbackParentTarget}
      mutable={Boolean(rootPath)}
      onAddToChat={onAddToChat}
      onCreateFile={openCreateFile}
      onCreateFolder={openCreateFolder}
      onDelete={(target, refresh) => void deleteEntry(target, refresh)}
      onFileOpen={onFileOpen}
      onRevealComplete={completeReveal}
      onRename={renameEntry}
      onRevealPath={onRevealPath}
      onSelect={selectEntry}
      onUpload={requestUpload}
      refresh={rootRefresh}
      relativePaths={Boolean(onAddToChat)}
      renderCreateFolder={renderCreateFolder}
      revealPath={revealPath}
      selectedPath={selectedPath}
      showRoot={false}
      treeRootKey={treeRootKey || null}
    />
  );
  const tree = (
    <WorkspaceProjectTree
      currentPath={rootPath}
      onBlankContext={clearSelection}
      rootDraft={createTarget?.path === rootPath ? renderCreateFolder(0) : null}
      showRoot={showRoot}
    >
      {treeEntries}
    </WorkspaceProjectTree>
  );
  const rootMenuGroups = rootTarget
    ? buildRootContextMenuGroups({
        busy,
        onCollapseAll: () => {
          if (treeRootKey) collapseAll(treeRootKey);
        },
        onCreateFile: () => openCreateFile(rootTarget),
        onCreateFolder: () => openCreateFolder(rootTarget),
        onRefresh: () => void rootRefresh(),
        onRevealPath,
        onUpload: () => requestUpload(rootTarget),
        target: rootTarget,
      })
    : [];

  const content = (
    <div
      className="flex h-full min-h-0 flex-col bg-white"
      onContextMenu={(event) => {
        if (!(event.target as HTMLElement).closest('[data-workspace-tree-entry]')) clearSelection();
      }}
    >
      {rootPath && toolbarTarget ? (
        <WorkspaceProjectFilesToolbar
          disabled={busy}
          rootLabel={rootLabel}
          onCollapseAll={() => {
            if (treeRootKey) collapseAll(treeRootKey);
          }}
          onNewFile={() => openCreateFile(toolbarTarget)}
          onNewFolder={() => openCreateFolder(toolbarTarget)}
          onRefresh={() => void rootRefresh()}
        />
      ) : null}
      {rootPath ? (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label={t('chatWorkspaceUploadFiles')}
          onChange={(event) => void uploadFiles(Array.from(event.currentTarget.files ?? []))}
        />
      ) : null}
      {tree}
      <ConfirmDialog />
    </div>
  );
  return rootTarget ? (
    <ContextMenu groups={rootMenuGroups} label={t('chatWorkspaceRootContextMenu')}>
      {content}
    </ContextMenu>
  ) : (
    content
  );
}

export function ChatSessionWorkspaceDirectoryBrowser({
  activeRelativePath = null,
  browseQuery,
  onFileOpen,
  sessionKey,
  renderStatus,
  showRoot = false,
}: ChatSessionWorkspaceDirectoryBrowserProps) {
  const presenter = usePresenter();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const entries = browseQuery.data?.entries ?? [];
  const errorMessage = readBrowseError(browseQuery);
  const rootPath = showRoot ? (browseQuery.data?.currentPath ?? null) : null;
  const treeRootKey = normalizeWorkspaceProjectTreeRootKey(rootPath);
  const expandedPaths = useWorkspaceProjectTreeStore((state) =>
    treeRootKey ? (state.trees[treeRootKey]?.expandedPaths ?? EMPTY_EXPANDED_PATHS) : EMPTY_EXPANDED_PATHS,
  );
  const watchedDirectories = useMemo(() => {
    if (!rootPath) return [];
    const separator = rootPath.includes('\\') && !rootPath.includes('/') ? '\\' : '/';
    const normalizedRoot = rootPath.replace(/[\\/]+$/g, '');
    const expandedPathSet = new Set(expandedPaths);
    const visibleExpandedPaths = expandedPaths.filter((relativePath) => {
      const segments = relativePath.split('/');
      return segments.slice(0, -1).every((_, index) => expandedPathSet.has(segments.slice(0, index + 1).join('/')));
    });
    return [
      rootPath,
      ...visibleExpandedPaths.map(
        (relativePath) => `${normalizedRoot}${separator}${relativePath.replace(/[\\/]+/g, separator)}`,
      ),
    ];
  }, [expandedPaths, rootPath]);
  useServerPathWatch(watchedDirectories);
  const rootLabel = rootPath ? readPathName(rootPath) : '';
  const controller = useWorkspaceProjectFilesController({
    activeRelativePath,
    confirm,
    onEntryDeleted: presenter.chatThreadManager.removeWorkspacePath,
    onEntryRenamed: presenter.chatThreadManager.renameWorkspacePath,
    rootPath,
  });
  const onRevealPath = hostCapabilityManager.canRevealPath()
    ? (path: string) => {
        void hostCapabilityManager.revealPath(path).then((result) => {
          if (!result.revealed) toast.error(t('chatWorkspaceRevealPathFailed'));
        });
      }
    : undefined;
  const onAddToChat =
    sessionKey !== undefined
      ? (entry: ServerPathEntryView, relativePath: string) => {
          const request =
            entry.kind === 'directory'
              ? presenter.chatComposerIntentManager.requestDirectoryReference
              : presenter.chatComposerIntentManager.requestFileReference;
          request({
            targetSessionKey: sessionKey,
            tokenKey: relativePath,
            label: entry.name,
          });
        }
      : undefined;

  if (browseQuery.isLoading && !browseQuery.data) {
    return renderStatus({ text: t('chatWorkspaceLoadingDirectory') });
  }
  if (errorMessage && !browseQuery.data) {
    return renderStatus({
      tone: 'error',
      text: `${t('chatWorkspaceDirectoryLoadFailed')}: ${errorMessage}`,
    });
  }
  return (
    <WorkspaceDirectoryBrowserReady
      activeRelativePath={activeRelativePath}
      browseQuery={browseQuery}
      ConfirmDialog={ConfirmDialog}
      controller={controller}
      entries={entries}
      onAddToChat={onAddToChat}
      onFileOpen={onFileOpen}
      onRevealPath={onRevealPath}
      rootLabel={rootLabel}
      rootPath={rootPath}
      showRoot={showRoot}
    />
  );
}
