import { useState, type MouseEvent } from 'react';
import { MoreVertical, PanelLeft, PanelLeftDashed, Star, Trash2, type LucideIcon } from 'lucide-react';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { PanelAppIcon } from '@/features/panel-apps/components/panel-app-icon';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { getLanguage, getLocale, t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

export function PanelAppListItem({
  deletePending,
  entry,
  favoritePending,
  mainSidebarPending,
  onDelete,
  onOpen,
  onToggleFavorite,
  onToggleMainSidebar,
}: {
  deletePending: boolean;
  entry: PanelAppEntryView;
  favoritePending: boolean;
  mainSidebarPending: boolean;
  onDelete: () => void;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onToggleMainSidebar: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const favoriteLabel = entry.favorite ? t('panelAppsUnfavorite') : t('panelAppsFavorite');
  const secondary = entry.lastOpenedAt
    ? `${t('panelAppsLastOpened')} ${formatPanelAppTime(entry.lastOpenedAt)}`
    : `${t('panelAppsUpdated')} ${formatPanelAppTime(entry.updatedAt)}`;

  const handleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleFavorite();
  };
  const handleMainSidebar = () => {
    setIsMenuOpen(false);
    onToggleMainSidebar();
  };
  const openDeleteDialog = () => {
    setIsMenuOpen(false);
    setIsDeleteDialogOpen(true);
  };
  const mainSidebarLabel = entry.mainSidebar
    ? t('panelAppsRemoveFromMainSidebar')
    : t('panelAppsAddToMainSidebar');

  return (
    <div className="group w-full min-w-0 rounded-lg border border-border/60 bg-card px-2.5 py-2.5 transition-colors hover:bg-muted/40">
      <div className="flex min-w-0 items-start gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-base text-muted-foreground">
              <PanelAppIcon icon={entry.icon} title={entry.title} />
            </span>
            <span className="block min-w-0 flex-1 truncate text-sm font-medium text-foreground">{entry.title}</span>
          </span>
          {entry.description ? (
            <span className="mt-1.5 block truncate text-xs leading-5 text-muted-foreground">{entry.description}</span>
          ) : null}
          <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground/70">{secondary}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={handleFavorite}
            disabled={favoritePending}
            className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            title={favoriteLabel}
            aria-label={favoriteLabel}
          >
            <Star className={entry.favorite ? 'h-4 w-4 fill-current text-foreground' : 'h-4 w-4'} />
          </button>
          <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t('panelAppsMoreActions')}
                disabled={deletePending}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 rounded-xl p-1.5">
              <PanelAppMenuItem
                disabled={mainSidebarPending}
                icon={entry.mainSidebar ? PanelLeftDashed : PanelLeft}
                label={mainSidebarLabel}
                onClick={handleMainSidebar}
              />
              <PanelAppMenuItem
                destructive
                disabled={deletePending}
                icon={Trash2}
                label={t('panelAppsDelete')}
                onClick={openDeleteDialog}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t('panelAppsDeleteConfirmTitle')}
        description={`${t('panelAppsDeleteConfirmDescription')} ${entry.fileName}`}
        confirmLabel={t('delete')}
        variant="destructive"
        onConfirm={onDelete}
        onCancel={() => undefined}
      />
    </div>
  );
}

function PanelAppMenuItem({
  destructive = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  destructive?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        destructive ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:bg-[var(--interaction-hover)] hover:text-accent-foreground',
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function formatPanelAppTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const locale = getLocale(getLanguage());
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { year: '2-digit', month: 'numeric', day: 'numeric' }).format(date);
}
