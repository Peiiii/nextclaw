import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Folder,
  FolderUp,
  Pencil,
  RefreshCcw,
  Search,
} from 'lucide-react';
import type { ServerPathBreadcrumbView } from '@/shared/lib/api';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Input } from '@/shared/components/ui/input';
import { t } from '@/shared/lib/i18n';

type ServerPathPickerNavigationBarProps = {
  addressPath: string;
  breadcrumbs: readonly ServerPathBreadcrumbView[];
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  disabled: boolean;
  onBack: () => void;
  onForward: () => void;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onUp: () => void;
  searchText: string;
};

export function ServerPathPickerNavigationBar({
  addressPath,
  breadcrumbs,
  canGoBack,
  canGoForward,
  canGoUp,
  disabled,
  onBack,
  onForward,
  onNavigate,
  onRefresh,
  onSearchChange,
  onUp,
  searchText,
}: ServerPathPickerNavigationBarProps) {
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const addressBreadcrumbs =
    breadcrumbs.length > 5
      ? [breadcrumbs[0], ...breadcrumbs.slice(-4)]
      : breadcrumbs;
  const breadcrumbsCollapsed = addressBreadcrumbs.length < breadcrumbs.length;

  const beginAddressEdit = () => {
    if (disabled) {
      return;
    }
    setAddressDraft(addressPath);
    setEditingAddress(true);
  };

  const cancelAddressEdit = () => {
    setAddressDraft('');
    setEditingAddress(false);
  };

  const openAddress = () => {
    const nextPath = addressDraft.trim();
    if (!nextPath) {
      return;
    }
    setEditingAddress(false);
    onNavigate(nextPath);
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden border-b border-border bg-muted/25 px-3 py-2">
      <IconActionButton
        icon={<ArrowLeft className="h-4 w-4" />}
        label={t('pathPickerBack')}
        size="lg"
        onClick={onBack}
        disabled={!canGoBack || disabled}
      />
      <IconActionButton
        icon={<ArrowRight className="h-4 w-4" />}
        label={t('pathPickerForward')}
        size="lg"
        onClick={onForward}
        disabled={!canGoForward || disabled}
      />
      <IconActionButton
        icon={<FolderUp className="h-4 w-4" />}
        label={t('parentDirectory')}
        size="lg"
        onClick={onUp}
        disabled={!canGoUp || disabled}
      />

      <div className="ml-1 flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-md border border-border bg-background shadow-sm focus-within:ring-1 focus-within:ring-primary/50">
        {editingAddress ? (
          <Input
            value={addressDraft}
            onChange={(event) => setAddressDraft(event.target.value)}
            onBlur={cancelAddressEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                openAddress();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelAddressEdit();
              }
            }}
            aria-label={t('pathPickerAddressLabel')}
            className="h-full rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0"
            autoFocus
          />
        ) : (
          <>
            <Folder className="ml-3 h-4 w-4 shrink-0 text-amber-500" />
            <div
              className="flex min-w-0 flex-1 items-center overflow-hidden pl-2"
              onDoubleClick={beginAddressEdit}
            >
              {addressBreadcrumbs.length > 0 ? (
                addressBreadcrumbs.map((breadcrumb, index) => (
                  <div key={breadcrumb.path} className="flex min-w-0 items-center">
                    {index > 0 ? (
                      <>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {breadcrumbsCollapsed && index === 1 ? (
                          <>
                            <button
                              type="button"
                              className="rounded px-1.5 py-1 text-sm text-muted-foreground hover:bg-accent"
                              aria-label={t('pathPickerShowFullAddress')}
                              onClick={beginAddressEdit}
                            >
                              …
                            </button>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </>
                        ) : null}
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="max-w-40 truncate rounded px-1.5 py-1 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                      onClick={() => onNavigate(breadcrumb.path)}
                      disabled={disabled}
                    >
                      {breadcrumb.label}
                    </button>
                  </div>
                ))
              ) : (
                <span className="truncate text-sm text-foreground">{addressPath}</span>
              )}
              <span className="h-full min-w-2 flex-1 cursor-text" aria-hidden="true" />
              <IconActionButton
                icon={<Pencil className="h-3.5 w-3.5" />}
                label={t('pathPickerEditAddress')}
                size="md"
                tooltipSide="bottom"
                onClick={beginAddressEdit}
                disabled={disabled}
                className="mr-1"
              />
            </div>
          </>
        )}
      </div>

      <IconActionButton
        icon={<RefreshCcw className="h-4 w-4" />}
        label={t('chatRefresh')}
        size="lg"
        onClick={onRefresh}
        disabled={disabled}
      />

      <div className="relative hidden w-56 shrink-0 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('pathPickerSearchPlaceholder')}
          disabled={disabled}
          className="h-9 rounded-md bg-background pl-9"
        />
      </div>
    </div>
  );
}
