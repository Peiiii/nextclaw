import { useState, type MouseEventHandler, type ReactNode } from 'react';
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
  useWorkspaceProjectFilesController,
  type RefreshDirectory,
  type WorkspaceDirectoryActionTarget,
  type WorkspaceTreeSelection,
} from '@/features/chat/features/workspace/hooks/use-workspace-file-actions';
import { ContextMenu, type ContextMenuGroup } from '@/shared/components/ui/context-menu/context-menu';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import type { useServerPathBrowse } from '@/shared/hooks/use-server-path-browse';
import type { ServerPathEntryView } from '@/shared/lib/api';
import { hostCapabilityManager } from '@/shared/lib/host-capabilities';
import { t } from '@/shared/lib/i18n';

type ChatSessionWorkspaceDirectoryBrowserProps = {
  browseQuery: ReturnType<typeof useServerPathBrowse>;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  sessionKey?: string | null;
  renderStatus: (params: { text: string; tone?: 'muted' | 'error' }) => ReactNode;
  showRoot?: boolean;
};

function readPathName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function WorkspaceDirectoryEntries({
  busy,
  collapseVersion,
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
}: {
  busy: boolean;
  collapseVersion: number;
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
}) {
  if (entries.length === 0) {
    return <div className="px-4 py-8 text-center text-xs text-gray-400">{t('chatWorkspaceDirectoryEmpty')}</div>;
  }
  return entries.map((entry) => (
    <WorkspaceDirectoryTreeEntry
      key={entry.path}
      browseParentRefresh={refresh}
      busy={busy}
      collapseVersion={collapseVersion}
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

function WorkspaceProjectTree({
  children,
  currentPath,
  onBlankContext,
  onContextMenu,
  rootDraft,
  showRoot,
}: {
  children: ReactNode;
  currentPath: string | null;
  onBlankContext: () => void;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
  rootDraft: ReactNode;
  showRoot: boolean;
}) {
  return (
    <div
      data-testid="workspace-directory-browser"
      role="tree"
      tabIndex={-1}
      aria-label={t('chatWorkspaceProjectFiles')}
      className="min-h-0 flex-1 overflow-auto py-1 custom-scrollbar"
      onContextMenu={(event) => {
        if (!(event.target as HTMLElement).closest('[data-workspace-tree-entry]')) onBlankContext();
        onContextMenu?.(event);
      }}
    >
      {showRoot && currentPath ? (
        <>
          {rootDraft}
          {children}
        </>
      ) : (
        children
      )}
    </div>
  );
}

function WorkspaceDirectoryBrowserReady({
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
  const {
    actions,
    cancelCreateFolder,
    clearSelection,
    completeReveal,
    submitCreate,
    createError,
    createKind,
    createName,
    createTarget,
    deleteEntry,
    fileInputRef,
    openCreateFile,
    openCreateFolder,
    requestUpload,
    renameEntry,
    revealPath,
    selectEntry,
    selectedCreateTarget,
    selectedPath,
    setCreateError,
    setCreateName,
    uploadFiles,
  } = controller;
  const busy = actions.pendingAction !== null;
  const [collapseVersion, setCollapseVersion] = useState(0);
  const rootRefresh = () => browseQuery.refetch();
  const rootTarget: WorkspaceDirectoryActionTarget | null = rootPath
    ? { label: rootLabel, path: rootPath, refresh: rootRefresh }
    : null;
  const toolbarTarget = selectedCreateTarget ?? rootTarget;
  const renderCreateFolder = (level: number) => (
    <WorkspaceNewFolderTreeItem
      error={createError}
      kind={createKind}
      isCreating={actions.pendingAction === 'create-directory' || actions.pendingAction === 'create-file'}
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
      busy={busy}
      collapseVersion={collapseVersion}
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
        onCollapseAll: () => setCollapseVersion((value) => value + 1),
        onCreateFile: () => openCreateFile(rootTarget),
        onCreateFolder: () => openCreateFolder(rootTarget),
        onRefresh: () => void browseQuery.refetch(),
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
          onCollapseAll={() => setCollapseVersion((value) => value + 1)}
          onNewFile={() => openCreateFile(toolbarTarget)}
          onNewFolder={() => openCreateFolder(toolbarTarget)}
          onRefresh={() => void browseQuery.refetch()}
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
  const rootLabel = rootPath ? readPathName(rootPath) : '';
  const controller = useWorkspaceProjectFilesController({
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
