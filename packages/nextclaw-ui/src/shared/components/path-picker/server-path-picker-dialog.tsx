import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useServerPathBrowse } from '@/shared/hooks/use-server-path-browse';
import { useServerPathCreateDirectory } from '@/shared/hooks/use-server-path-create-directory';
import { ServerPathPickerDirectoryList } from '@/shared/components/path-picker/server-path-picker-directory-list';
import { ServerPathPickerFooter } from '@/shared/components/path-picker/server-path-picker-footer';
import { ServerPathPickerLocations } from '@/shared/components/path-picker/server-path-picker-locations';
import { ServerPathPickerNavigationBar } from '@/shared/components/path-picker/server-path-picker-navigation-bar';
import { ServerPathPickerNewFolder } from '@/shared/components/path-picker/server-path-picker-new-folder';
import { ServerPathPickerToolbar } from '@/shared/components/path-picker/server-path-picker-toolbar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { t } from '@/shared/lib/i18n';

type ServerPathPickerDialogProps = {
  open: boolean;
  allowCreateDirectory?: boolean;
  currentPath?: string | null;
  defaultWorkspacePath?: string | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (path: string) => Promise<void> | void;
  title: string;
  description?: string;
  pathLabel: string;
  pathPlaceholder?: string;
  confirmLabel: string;
  hint?: string;
};

function resolveHomeRelativePath(path: string, homePath?: string | null): string {
  if (!homePath) {
    return path;
  }
  if (path === '~') {
    return homePath;
  }
  const windowsHome = homePath.includes('\\');
  if (path.startsWith('~/') || (windowsHome && path.startsWith('~\\'))) {
    const separator = windowsHome ? '\\' : '/';
    const relativePath = path.slice(2).replaceAll(separator === '\\' ? '/' : '\\', separator);
    return `${homePath.replace(/[\\/]+$/, '')}${separator}${relativePath}`;
  }
  return path;
}

export function ServerPathPickerDialog({
  open,
  allowCreateDirectory = true,
  currentPath,
  defaultWorkspacePath,
  isSaving,
  onOpenChange,
  onConfirm,
  title,
  description,
  pathLabel,
  pathPlaceholder,
  confirmLabel,
  hint,
}: ServerPathPickerDialogProps) {
  const normalizedCurrentPath = currentPath?.trim() ?? '';
  const normalizedDefaultWorkspacePath = defaultWorkspacePath?.trim() ?? '';
  const sessionKey = `${normalizedCurrentPath}\u0000${normalizedDefaultWorkspacePath}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSaving) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:h-[44rem] sm:max-w-5xl sm:grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>
            {description ?? title}
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <ServerPathPickerSession
            key={sessionKey}
            allowCreateDirectory={allowCreateDirectory}
            currentPath={normalizedCurrentPath}
            defaultWorkspacePath={normalizedDefaultWorkspacePath}
            isSaving={isSaving}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
            pathLabel={pathLabel}
            pathPlaceholder={pathPlaceholder}
            confirmLabel={confirmLabel}
            hint={hint}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type ServerPathPickerSessionProps = {
  allowCreateDirectory: boolean;
  currentPath: string;
  defaultWorkspacePath: string;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (path: string) => Promise<void> | void;
  pathLabel: string;
  pathPlaceholder?: string;
  confirmLabel: string;
  hint?: string;
};

function ServerPathPickerSession({
  allowCreateDirectory,
  currentPath,
  defaultWorkspacePath,
  isSaving,
  onCancel,
  onConfirm,
  pathLabel,
  pathPlaceholder,
  confirmLabel,
  hint,
}: ServerPathPickerSessionProps) {
  const initialPath = currentPath || defaultWorkspacePath;
  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath || null);
  const [browsePath, setBrowsePath] = useState<string | null>(initialPath || null);
  const [backPaths, setBackPaths] = useState<string[]>([]);
  const [forwardPaths, setForwardPaths] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const browseQuery = useServerPathBrowse({
    path: browsePath,
    enabled: true,
  });
  const createDirectoryMutation = useServerPathCreateDirectory();
  const resolvedBrowsePath = resolveHomeRelativePath(
    browsePath?.trim() ?? '',
    browseQuery.data?.homePath,
  );
  const canonicalSelectedPath =
    selectedPath === null
      ? (browseQuery.data?.currentPath ?? '')
      : selectedPath === browsePath && browseQuery.data?.currentPath === resolvedBrowsePath
        ? browseQuery.data.currentPath
        : selectedPath;
  const normalizedSelectedPath = canonicalSelectedPath.trim();
  const submitDisabled = normalizedSelectedPath.length === 0 || isSaving;
  const addressPath = resolvedBrowsePath || browseQuery.data?.currentPath || '';
  const visibleBreadcrumbs =
    !browsePath || browseQuery.data?.currentPath === addressPath
      ? (browseQuery.data?.breadcrumbs ?? [])
      : [];
  const errorMessage = useMemo(() => {
    if (!browseQuery.error) {
      return null;
    }
    return browseQuery.error instanceof Error
      ? browseQuery.error.message
      : String(browseQuery.error);
  }, [browseQuery.error]);
  const createDirectoryErrorMessage = useMemo(() => {
    if (!createDirectoryMutation.error) {
      return null;
    }
    return createDirectoryMutation.error instanceof Error
      ? createDirectoryMutation.error.message
      : String(createDirectoryMutation.error);
  }, [createDirectoryMutation.error]);

  const normalizedSearchText = searchText.trim().toLowerCase();
  const directoryEntries = useMemo(
    () => (browseQuery.data?.entries ?? []).filter((entry) => entry.kind === 'directory'),
    [browseQuery.data?.entries],
  );
  const filteredEntries = useMemo(() => {
    if (normalizedSearchText.length === 0) {
      return directoryEntries;
    }
    return directoryEntries.filter((entry) => {
      const normalizedName = entry.name.toLowerCase();
      const normalizedPath = entry.path.toLowerCase();
      return (
        normalizedName.includes(normalizedSearchText) ||
        normalizedPath.includes(normalizedSearchText)
      );
    });
  }, [directoryEntries, normalizedSearchText]);

  const showPath = (path: string) => {
    setBrowsePath(path);
    setSelectedPath(path);
    setSearchText('');
    setNewFolderVisible(false);
    setNewFolderName('');
    createDirectoryMutation.reset();
  };

  const navigateTo = (path: string) => {
    const nextPath = path.trim();
    if (!nextPath) {
      return;
    }
    const visiblePath = addressPath;
    if (visiblePath && visiblePath !== nextPath) {
      setBackPaths((paths) => [...paths, visiblePath].slice(-50));
    }
    setForwardPaths([]);
    showPath(nextPath);
  };

  const navigateBack = () => {
    const targetPath = backPaths.at(-1);
    if (!targetPath) {
      return;
    }
    const visiblePath = addressPath;
    setBackPaths((paths) => paths.slice(0, -1));
    if (visiblePath) {
      setForwardPaths((paths) => [visiblePath, ...paths].slice(0, 50));
    }
    showPath(targetPath);
  };

  const navigateForward = () => {
    const targetPath = forwardPaths[0];
    if (!targetPath) {
      return;
    }
    const visiblePath = addressPath;
    setForwardPaths((paths) => paths.slice(1));
    if (visiblePath) {
      setBackPaths((paths) => [...paths, visiblePath].slice(-50));
    }
    showPath(targetPath);
  };

  const createDirectory = async () => {
    const parentPath = browseQuery.data?.currentPath;
    const name = newFolderName.trim();
    if (!allowCreateDirectory || !parentPath || !name || createDirectoryMutation.isPending) {
      return;
    }
    try {
      const created = await createDirectoryMutation.mutateAsync({ parentPath, name });
      await browseQuery.refetch();
      setSelectedPath(created.path);
      setNewFolderName('');
      setNewFolderVisible(false);
    } catch {
      // The mutation owns the user-visible error state rendered below the input.
    }
  };

  const emptyMessage = browseQuery.isLoading
    ? t('loading')
    : errorMessage
      ? `${t('pathBrowseFailed')}: ${errorMessage}`
      : directoryEntries.length > 0
        ? t('pathPickerSearchEmpty')
        : t('emptyDirectory');
  const navigationDisabled = isSaving || browseQuery.isLoading;

  return (
    <form
      className="flex min-h-0 min-w-0 flex-col overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitDisabled) {
          return;
        }
        void onConfirm(normalizedSelectedPath);
      }}
    >
          <ServerPathPickerNavigationBar
            addressPath={addressPath}
            breadcrumbs={visibleBreadcrumbs}
            canGoBack={backPaths.length > 0}
            canGoForward={forwardPaths.length > 0}
            canGoUp={Boolean(browseQuery.data?.parentPath)}
            disabled={navigationDisabled}
            onBack={navigateBack}
            onForward={navigateForward}
            onNavigate={navigateTo}
            onRefresh={() => void browseQuery.refetch()}
            onSearchChange={setSearchText}
            onUp={() => {
              const parentPath = browseQuery.data?.parentPath;
              if (parentPath) {
                navigateTo(parentPath);
              }
            }}
            searchText={searchText}
          />

          <ServerPathPickerToolbar
            allowCreateDirectory={allowCreateDirectory}
            disabled={navigationDisabled || !browseQuery.data?.currentPath}
            onNewFolder={() => {
              setNewFolderVisible(true);
              setNewFolderName('');
              createDirectoryMutation.reset();
            }}
          />

          <div className="relative border-b border-border p-2 sm:hidden">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t('pathPickerSearchPlaceholder')}
              disabled={navigationDisabled}
              className="h-9 pl-9"
            />
          </div>

          {allowCreateDirectory && newFolderVisible ? (
            <ServerPathPickerNewFolder
              errorMessage={createDirectoryErrorMessage}
              isCreating={createDirectoryMutation.isPending}
              name={newFolderName}
              onCancel={() => setNewFolderVisible(false)}
              onCreate={() => void createDirectory()}
              onNameChange={(name) => {
                setNewFolderName(name);
                createDirectoryMutation.reset();
              }}
            />
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <ServerPathPickerLocations
              currentPath={addressPath}
              defaultWorkspacePath={
                resolveHomeRelativePath(defaultWorkspacePath, browseQuery.data?.homePath) ||
                null
              }
              disabled={navigationDisabled}
              homePath={browseQuery.data?.homePath}
              locations={browseQuery.data?.locations ?? []}
              rootPath={browseQuery.data?.breadcrumbs[0]?.path}
              onNavigate={navigateTo}
            />
            <ServerPathPickerDirectoryList
              entries={filteredEntries}
              emptyMessage={emptyMessage}
              disabled={isSaving}
              onOpen={navigateTo}
              onSelect={setSelectedPath}
              selectedPath={normalizedSelectedPath}
            />
          </div>

          <ServerPathPickerFooter
            confirmLabel={confirmLabel}
            disabled={submitDisabled}
            hint={hint}
            isSaving={isSaving}
            onCancel={onCancel}
            onSelectedPathChange={setSelectedPath}
            pathLabel={pathLabel}
            pathPlaceholder={pathPlaceholder}
            selectedPath={canonicalSelectedPath}
          />
    </form>
  );
}
