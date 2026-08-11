import { useEffect, useRef, useState } from 'react';
import { NextClawClientError } from '@nextclaw/client-sdk';
import { toast } from 'sonner';
import type { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import {
  createServerPathDirectory,
  createServerPathFile,
  deleteServerPathEntry,
  renameServerPathEntry,
  uploadServerPathFiles,
  type ServerPathEntryView,
} from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

type WorkspaceFilePendingAction = 'create-directory' | 'create-file' | 'delete' | 'rename' | 'upload';
type Confirm = ReturnType<typeof useConfirmDialog>['confirm'];

export type RefreshDirectory = () => Promise<unknown>;

export type WorkspaceDirectoryActionTarget = {
  label: string;
  path: string;
  refresh: RefreshDirectory;
  expand?: () => void;
};

export type WorkspaceTreeSelection = {
  path: string;
  createTarget: WorkspaceDirectoryActionTarget;
};

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function replaceCount(text: string, count: number): string {
  return text.replace('{count}', String(count));
}

function useWorkspaceFileActions() {
  const [pendingAction, setPendingAction] = useState<WorkspaceFilePendingAction | null>(null);
  const pendingActionRef = useRef<WorkspaceFilePendingAction | null>(null);

  const run = async <T>(action: WorkspaceFilePendingAction, operation: () => Promise<T>): Promise<T> => {
    if (pendingActionRef.current) {
      throw new Error('another workspace file operation is already running');
    }
    pendingActionRef.current = action;
    setPendingAction(action);
    try {
      return await operation();
    } finally {
      pendingActionRef.current = null;
      setPendingAction(null);
    }
  };

  return {
    pendingAction,
    createDirectory: (params: { basePath: string; parentPath: string; name: string }) =>
      run('create-directory', () => createServerPathDirectory(params)),
    createFile: (params: { basePath: string; parentPath: string; name: string }) =>
      run('create-file', () => createServerPathFile(params)),
    deleteEntry: (params: { basePath: string; path: string }) => run('delete', () => deleteServerPathEntry(params)),
    renameEntry: (params: { basePath: string; path: string; name: string }) =>
      run('rename', () => renameServerPathEntry(params)),
    uploadFiles: (params: { basePath: string; targetPath: string; files: readonly File[]; overwrite?: boolean }) =>
      run('upload', () => uploadServerPathFiles(params)),
  };
}

type WorkspaceFileActions = ReturnType<typeof useWorkspaceFileActions>;

async function uploadWorkspaceFiles({
  actions,
  confirm,
  files,
  rootPath,
  target,
}: {
  actions: WorkspaceFileActions;
  confirm: Confirm;
  files: readonly File[];
  rootPath: string;
  target: WorkspaceDirectoryActionTarget;
}) {
  try {
    let result;
    try {
      result = await actions.uploadFiles({
        basePath: rootPath,
        targetPath: target.path,
        files,
      });
    } catch (error) {
      if (!(error instanceof NextClawClientError) || error.code !== 'SERVER_PATH_FILE_EXISTS') {
        throw error;
      }
      const conflicts = Array.isArray(error.details?.conflicts) ? error.details.conflicts.length : files.length;
      const shouldReplace = await confirm({
        title: t('chatWorkspaceUploadConflictTitle'),
        description: replaceCount(t('chatWorkspaceUploadConflictDescription'), conflicts),
        confirmLabel: t('chatWorkspaceReplaceFiles'),
        variant: 'destructive',
      });
      if (!shouldReplace) return;
      result = await actions.uploadFiles({
        basePath: rootPath,
        targetPath: target.path,
        files,
        overwrite: true,
      });
    }
    await target.refresh();
    toast.success(replaceCount(t('chatWorkspaceUploadSucceeded'), result.files.length));
  } catch (error) {
    toast.error(`${t('chatWorkspaceUploadFailed')}: ${readErrorMessage(error)}`);
  }
}

async function deleteWorkspaceEntry({
  actions,
  confirm,
  entry,
  refresh,
  rootPath,
}: {
  actions: WorkspaceFileActions;
  confirm: Confirm;
  entry: ServerPathEntryView;
  refresh: RefreshDirectory;
  rootPath: string;
}) {
  const isDirectory = entry.kind === 'directory';
  const confirmed = await confirm({
    title: t(isDirectory ? 'chatWorkspaceDeleteFolderTitle' : 'chatWorkspaceDeleteFileTitle').replace(
      '{name}',
      entry.name,
    ),
    description: t(isDirectory ? 'chatWorkspaceDeleteFolderDescription' : 'chatWorkspaceDeleteFileDescription'),
    confirmLabel: t('chatWorkspaceDelete'),
    variant: 'destructive',
  });
  if (!confirmed) return;
  const toastId = toast.loading(t('chatWorkspaceDeleting').replace('{name}', entry.name));
  try {
    const deleted = await actions.deleteEntry({
      basePath: rootPath,
      path: entry.path,
    });
    await refresh();
    toast.dismiss(toastId);
    toast.success(t('chatWorkspaceDeleteSucceeded').replace('{name}', entry.name));
    return deleted;
  } catch (error) {
    toast.dismiss(toastId);
    toast.error(`${t('chatWorkspaceDeleteFailed').replace('{name}', entry.name)}: ${readErrorMessage(error)}`);
    return null;
  }
}

async function createWorkspaceEntry({
  actions,
  kind,
  name,
  rootPath,
  setError,
  target,
}: {
  actions: WorkspaceFileActions;
  kind: 'directory' | 'file';
  name: string;
  rootPath: string;
  setError: (error: string | null) => void;
  target: WorkspaceDirectoryActionTarget;
}) {
  setError(null);
  try {
    const created = await (kind === 'file' ? actions.createFile : actions.createDirectory)({
      basePath: rootPath,
      parentPath: target.path,
      name,
    });
    await target.refresh();
    toast.success(t(kind === 'file' ? 'chatWorkspaceFileCreated' : 'chatWorkspaceFolderCreated'));
    return created;
  } catch (error) {
    setError(
      `${t(kind === 'file' ? 'chatWorkspaceFileCreateFailed' : 'chatWorkspaceFolderCreateFailed')}: ${readErrorMessage(error)}`,
    );
    return null;
  }
}

type WorkspaceProjectFilesControllerOptions = {
  confirm: Confirm;
  onEntryDeleted?: (path: string) => void;
  onEntryRenamed?: (params: { previousPath: string; path: string; label: string }) => void;
  rootPath: string | null;
};

export function useWorkspaceProjectFilesController({
  confirm,
  onEntryDeleted,
  onEntryRenamed,
  rootPath,
}: WorkspaceProjectFilesControllerOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actions = useWorkspaceFileActions();
  const [createTarget, setCreateTarget] = useState<WorkspaceDirectoryActionTarget | null>(null);
  const [createName, setCreateName] = useState('');
  const [createKind, setCreateKind] = useState<'directory' | 'file'>('directory');
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedCreateTarget, setSelectedCreateTarget] = useState<WorkspaceDirectoryActionTarget | null>(null);
  const [revealPath, setRevealPath] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<WorkspaceDirectoryActionTarget | null>(null);

  useEffect(() => {
    setCreateTarget(null);
    setSelectedPath(null);
    setSelectedCreateTarget(null);
    setRevealPath(null);
    setUploadTarget(null);
  }, [rootPath]);

  const requestUpload = (target: WorkspaceDirectoryActionTarget) => {
    setUploadTarget(target);
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };
  const selectEntry = (selection: WorkspaceTreeSelection) => {
    setSelectedPath(selection.path);
    setSelectedCreateTarget(selection.createTarget);
  };
  const openCreate = (kind: 'directory' | 'file', target: WorkspaceDirectoryActionTarget) => {
    target.expand?.();
    setCreateKind(kind);
    setCreateName('');
    setCreateError(null);
    setCreateTarget(target);
  };
  const uploadFiles = async (files: readonly File[]) => {
    if (!rootPath || !uploadTarget || files.length === 0) return;
    await uploadWorkspaceFiles({
      actions,
      confirm,
      files,
      rootPath,
      target: uploadTarget,
    });
  };
  const deleteEntry = async (entry: ServerPathEntryView, refresh: RefreshDirectory) => {
    if (!rootPath) return;
    const deleted = await deleteWorkspaceEntry({
      actions,
      confirm,
      entry,
      refresh,
      rootPath,
    });
    if (deleted) onEntryDeleted?.(deleted.path);
  };
  const renameEntry = async (entry: ServerPathEntryView, name: string, refresh: RefreshDirectory) => {
    if (!rootPath) return null;
    const renamed = await actions.renameEntry({
      basePath: rootPath,
      path: entry.path,
      name,
    });
    onEntryRenamed?.({
      previousPath: renamed.oldPath,
      path: renamed.path,
      label: renamed.name,
    });
    await refresh();
    setSelectedPath(renamed.path);
    setRevealPath(renamed.path);
    toast.success(t('chatWorkspaceRenameSucceeded').replace('{name}', renamed.name));
    return renamed;
  };
  const submitCreate = async () => {
    if (!rootPath || !createTarget) return;
    const created = await createWorkspaceEntry({
      actions,
      kind: createKind,
      name: createName,
      rootPath,
      setError: setCreateError,
      target: createTarget,
    });
    if (!created) return;
    setCreateTarget(null);
    setSelectedPath(created.path);
    setSelectedCreateTarget({
      label: createName.trim(),
      path: created.path,
      refresh: createTarget.refresh,
    });
    setRevealPath(created.path);
  };

  return {
    actions,
    cancelCreateFolder: () => {
      setCreateTarget(null);
      setCreateName('');
      setCreateError(null);
    },
    clearSelection: () => {
      setSelectedPath(null);
      setSelectedCreateTarget(null);
    },
    completeReveal: () => setRevealPath(null),
    submitCreate,
    createError,
    createName,
    createKind,
    createTarget,
    deleteEntry,
    fileInputRef,
    openCreateFile: (target: WorkspaceDirectoryActionTarget) => openCreate('file', target),
    openCreateFolder: (target: WorkspaceDirectoryActionTarget) => openCreate('directory', target),
    requestUpload,
    renameEntry,
    revealPath,
    selectEntry,
    selectedCreateTarget,
    selectedPath,
    setCreateError,
    setCreateName,
    uploadFiles,
  };
}
