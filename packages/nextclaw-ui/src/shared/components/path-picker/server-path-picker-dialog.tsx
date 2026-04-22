import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Folder, FolderUp, Home, RefreshCcw, Search } from 'lucide-react';
import { useServerPathBrowse } from '@/shared/hooks/use-server-path-browse';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { t } from '@/shared/lib/i18n';

type ServerPathPickerDialogProps = {
  open: boolean;
  currentPath?: string | null;
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

export function ServerPathPickerDialog({
  open,
  currentPath,
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
  const [draftPath, setDraftPath] = useState('');
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextPath = currentPath?.trim() || null;
    setDraftPath(nextPath ?? '');
    setBrowsePath(nextPath);
    setSearchText('');
  }, [currentPath, open]);

  const browseQuery = useServerPathBrowse({
    path: browsePath,
    enabled: open,
  });

  useEffect(() => {
    if (!open || !browseQuery.data) {
      return;
    }
    if (draftPath.trim().length === 0) {
      setDraftPath(browseQuery.data.currentPath);
    }
  }, [browseQuery.data, draftPath, open]);

  const normalizedDraftPath = draftPath.trim();
  const submitDisabled = normalizedDraftPath.length === 0 || isSaving;
  const errorMessage = useMemo(() => {
    if (!browseQuery.error) {
      return null;
    }
    return browseQuery.error instanceof Error
      ? browseQuery.error.message
      : String(browseQuery.error);
  }, [browseQuery.error]);

  const normalizedSearchText = searchText.trim().toLowerCase();
  const filteredEntries = useMemo(() => {
    const entries = browseQuery.data?.entries ?? [];
    if (normalizedSearchText.length === 0) {
      return entries;
    }
    return entries.filter((entry) => {
      const normalizedName = entry.name.toLowerCase();
      const normalizedPath = entry.path.toLowerCase();
      return (
        normalizedName.includes(normalizedSearchText) ||
        normalizedPath.includes(normalizedSearchText)
      );
    });
  }, [browseQuery.data?.entries, normalizedSearchText]);

  const navigateTo = (path: string | null) => {
    setBrowsePath(path);
    setSearchText('');
    if (path) {
      setDraftPath(path);
    }
  };

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
      <DialogContent className="max-h-[85vh] overflow-hidden sm:h-[42rem] sm:max-w-2xl sm:grid-rows-[auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (submitDisabled) {
              return;
            }
            void onConfirm(normalizedDraftPath);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="server-path-picker-input">{pathLabel}</Label>
            <div className="flex gap-2">
              <Input
                id="server-path-picker-input"
                value={draftPath}
                onChange={(event) => setDraftPath(event.target.value)}
                placeholder={pathPlaceholder}
                autoFocus
                disabled={isSaving}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => navigateTo(normalizedDraftPath || null)}
                disabled={isSaving}
              >
                {t('openPath')}
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/70">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigateTo(browseQuery.data?.homePath ?? null)}
                disabled={isSaving || browseQuery.isLoading}
              >
                <Home className="mr-1 h-4 w-4" />
                {t('homeDirectory')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigateTo(browseQuery.data?.parentPath ?? null)}
                disabled={!browseQuery.data?.parentPath || isSaving || browseQuery.isLoading}
              >
                <FolderUp className="mr-1 h-4 w-4" />
                {t('parentDirectory')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void browseQuery.refetch();
                }}
                disabled={isSaving || browseQuery.isLoading}
              >
                <RefreshCcw className="mr-1 h-4 w-4" />
                {t('chatRefresh')}
              </Button>
            </div>

            <div className="border-b border-gray-200 px-3 py-2">
              <div className="mb-2 text-xs font-medium text-gray-500">
                {t('currentDirectory')}
              </div>
              <div className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
                {browseQuery.data?.breadcrumbs.map((breadcrumb, index) => (
                  <div key={breadcrumb.path} className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 hover:bg-gray-200"
                      onClick={() => navigateTo(breadcrumb.path)}
                      disabled={isSaving}
                    >
                      {breadcrumb.label}
                    </button>
                    {index < browseQuery.data.breadcrumbs.length - 1 ? (
                      <ChevronRight className="h-3 w-3 text-gray-400" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-gray-200 px-3 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t('pathPickerSearchPlaceholder')}
                  disabled={isSaving || browseQuery.isLoading}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 px-2 py-2">
              {browseQuery.isLoading ? (
                <div className="px-2 py-6 text-sm text-gray-500">{t('loading')}</div>
              ) : errorMessage ? (
                <div className="px-2 py-4 text-sm text-destructive">
                  {t('pathBrowseFailed')}: {errorMessage}
                </div>
              ) : browseQuery.data && filteredEntries.length > 0 ? (
                <div className="space-y-1">
                  {filteredEntries.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-white"
                      onClick={() => navigateTo(entry.path)}
                      disabled={isSaving}
                    >
                      <Folder className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="truncate">{entry.name}</span>
                    </button>
                  ))}
                </div>
              ) : browseQuery.data && browseQuery.data.entries.length > 0 ? (
                <div className="px-2 py-6 text-sm text-gray-500">
                  {t('pathPickerSearchEmpty')}
                </div>
              ) : (
                <div className="px-2 py-6 text-sm text-gray-500">{t('emptyDirectory')}</div>
              )}
            </ScrollArea>
          </div>

          {hint ? (
            <p className="text-xs leading-relaxed text-gray-500">{hint}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {isSaving ? t('saving') : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
