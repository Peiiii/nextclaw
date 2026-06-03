import { useMemo, useState, type ReactNode } from 'react';
import { HelpCircle, RefreshCw } from 'lucide-react';
import { useAppPresenter } from '@/app/components/app-presenter-provider';
import { PanelAppListItem } from '@/features/panel-apps/components/panel-app-list-item';
import { useDeletePanelApp, useGrantPanelAppClient, usePanelApps, useRecordPanelAppOpened, useUpdatePanelAppPreferences } from '@/features/panel-apps/hooks/use-panel-apps';
import { getPanelAppViewEntries } from '@/features/panel-apps/utils/panel-app-view.utils';
import type { PanelAppViewMode } from '@/features/panel-apps/utils/panel-app-view.utils';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { t } from '@/shared/lib/i18n';

export function PanelAppsList({
  headerContent,
  onOpenPanelApp,
}: {
  headerContent?: ReactNode;
  onOpenPanelApp: (entry: PanelAppEntryView) => void;
}) {
  const panelApps = usePanelApps();
  const deletePanelApp = useDeletePanelApp();
  const updatePreferences = useUpdatePanelAppPreferences();
  const recordOpened = useRecordPanelAppOpened();
  const grantClient = useGrantPanelAppClient();
  const presenter = useAppPresenter();
  const [viewMode, setViewMode] = useState<PanelAppViewMode>('smart');
  const entries = useMemo(
    () => getPanelAppViewEntries(panelApps.data?.entries ?? [], viewMode),
    [panelApps.data?.entries, viewMode],
  );

  const openPanelApp = async (entry: PanelAppEntryView) => {
    if (!(await ensurePanelAppClientGrant(entry))) {
      return;
    }
    try {
      onOpenPanelApp(await recordOpened.mutateAsync(entry.id));
    } catch {
      onOpenPanelApp(entry);
    }
  };

  const ensurePanelAppClientGrant = async (entry: PanelAppEntryView): Promise<boolean> => {
    if (!entry.clientDeclared || entry.clientGranted) {
      return true;
    }
    const allowed = await presenter.serviceActionAuthorizationManager.requestAuthorization({
      panelAppId: entry.appId,
      actions: [{
        actionId: 'nextclaw.client',
        actionTitle: t('panelAppsClientGrantTitle'),
        actionDescription: t('panelAppsClientGrantDescription'),
        risk: 'dangerous',
      }],
    });
    if (!allowed) {
      return false;
    }
    await grantClient.mutateAsync(entry.appId);
    return true;
  };

  const toggleFavorite = (entry: PanelAppEntryView) => {
    updatePreferences.mutate({
      id: entry.id,
      preferences: { favorite: !entry.favorite },
    });
  };

  const deleteEntry = (entry: PanelAppEntryView) => {
    deletePanelApp.mutate(entry.id);
  };

  if (panelApps.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">{t('panelAppsLoading')}</div>
    );
  }

  if (panelApps.isError) {
    return (
      <div className="p-4 text-sm text-rose-600">{panelApps.error instanceof Error ? panelApps.error.message : t('panelAppsLoadFailed')}</div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {headerContent ?? (
            <div className="truncate text-sm font-semibold text-gray-900">{t('panelAppsTitle')}</div>
          )}
          {panelApps.data?.panelsPath ? (
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label={t('panelAppsTitle')}><HelpCircle className="h-3.5 w-3.5" /></button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[320px] break-all font-mono text-xs">{panelApps.data.panelsPath}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
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
      <div className="border-b border-gray-100 px-3 py-2">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as PanelAppViewMode)}>
          <TabsList className="grid h-auto w-full grid-cols-5 rounded-lg bg-gray-100/70 p-0.5">
            <TabsTrigger value="smart" className="px-2 py-1 text-xs">{t('panelAppsSortSmart')}</TabsTrigger>
            <TabsTrigger value="favorites" className="px-2 py-1 text-xs">{t('panelAppsFavorites')}</TabsTrigger>
            <TabsTrigger value="recent-open" className="px-2 py-1 text-xs">{t('panelAppsSortRecentOpen')}</TabsTrigger>
            <TabsTrigger value="updated" className="px-2 py-1 text-xs">{t('panelAppsSortUpdated')}</TabsTrigger>
            <TabsTrigger value="name" className="px-2 py-1 text-xs">{t('panelAppsSortName')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">{t('panelAppsEmpty')}</div>
      ) : (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <PanelAppListItem
                key={entry.id}
                entry={entry}
                deletePending={deletePanelApp.isPending}
                favoritePending={updatePreferences.isPending}
                onDelete={() => deleteEntry(entry)}
                onOpen={() => void openPanelApp(entry)}
                onToggleFavorite={() => toggleFavorite(entry)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
