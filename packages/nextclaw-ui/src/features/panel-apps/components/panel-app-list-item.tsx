import type { MouseEvent } from 'react';
import { AppWindow, Star } from 'lucide-react';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { formatDateTime, t } from '@/shared/lib/i18n';

export function PanelAppListItem({
  entry,
  favoritePending,
  onOpen,
  onToggleFavorite,
}: {
  entry: PanelAppEntryView;
  favoritePending: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const favoriteLabel = entry.favorite ? t('panelAppsUnfavorite') : t('panelAppsFavorite');
  const secondary = entry.lastOpenedAt
    ? `${t('panelAppsLastOpened')} ${formatDateTime(entry.lastOpenedAt)}`
    : `${t('panelAppsUpdated')} ${formatDateTime(entry.updatedAt)}`;
  const handleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleFavorite();
  };

  return (
    <div className="group flex w-full min-w-0 items-start gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2.5 transition-colors hover:border-amber-200 hover:bg-amber-50/50">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-base text-amber-700">
          {entry.icon ? entry.icon : <AppWindow className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">{entry.title}</span>
          {entry.description ? (
            <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-gray-600">{entry.description}</span>
          ) : null}
          <span className="mt-1 block truncate text-xs text-gray-400">{secondary}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={handleFavorite}
        disabled={favoritePending}
        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-amber-500 disabled:opacity-50"
        title={favoriteLabel}
        aria-label={favoriteLabel}
      >
        <Star className={entry.favorite ? 'h-4 w-4 fill-amber-400 text-amber-500' : 'h-4 w-4'} />
      </button>
    </div>
  );
}
