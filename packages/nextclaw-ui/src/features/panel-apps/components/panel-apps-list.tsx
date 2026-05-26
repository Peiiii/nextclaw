import { AppWindow, RefreshCw } from 'lucide-react';
import { usePanelApps } from '@/features/panel-apps/hooks/use-panel-apps';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { formatDateTime, t } from '@/shared/lib/i18n';

export function PanelAppsList({
  onOpenPanelApp,
}: {
  onOpenPanelApp: (entry: PanelAppEntryView) => void;
}) {
  const panelApps = usePanelApps();
  const entries = panelApps.data?.entries ?? [];

  if (panelApps.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        {t('panelAppsLoading')}
      </div>
    );
  }

  if (panelApps.isError) {
    return (
      <div className="p-4 text-sm text-rose-600">
        {panelApps.error instanceof Error ? panelApps.error.message : t('panelAppsLoadFailed')}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{t('panelAppsTitle')}</div>
          <div className="truncate font-mono text-[11px] text-gray-400">{panelApps.data?.panelsPath}</div>
        </div>
        <button
          type="button"
          onClick={() => void panelApps.refetch()}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          title={t('panelAppsRefresh')}
          aria-label={t('panelAppsRefresh')}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">
          {t('panelAppsEmpty')}
        </div>
      ) : (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenPanelApp(entry)}
                className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-amber-200 hover:bg-amber-50/50"
              >
                <AppWindow className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{entry.title}</span>
                  <span className="block truncate text-[11px] text-gray-500">
                    {entry.fileName} - {formatDateTime(entry.updatedAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
