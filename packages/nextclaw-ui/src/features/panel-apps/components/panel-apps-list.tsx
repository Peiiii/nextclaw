import { useMemo, useState, type ReactNode } from 'react';
import { AppWindow, FileCode2, HelpCircle, MessageSquarePlus, RefreshCw } from 'lucide-react';
import { useAppPresenter } from '@/app/components/app-presenter-provider';
import { PanelAppListItem } from '@/features/panel-apps/components/panel-app-list-item';
import { useDeletePanelApp, useGrantPanelAppClient, usePanelApps, useRecordPanelAppOpened, useUpdatePanelAppPreferences } from '@/features/panel-apps/hooks/use-panel-apps';
import { getPanelAppViewEntries } from '@/features/panel-apps/utils/panel-app-view.utils';
import type { PanelAppViewMode } from '@/features/panel-apps/utils/panel-app-view.utils';
import type { PanelAppEntryView } from '@/shared/lib/api';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { t } from '@/shared/lib/i18n';

const EMPTY_PANEL_APP_ENTRIES: PanelAppEntryView[] = [];

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
  const allEntries = panelApps.data?.entries ?? EMPTY_PANEL_APP_ENTRIES;
  const entries = useMemo(
    () => getPanelAppViewEntries(allEntries, viewMode),
    [allEntries, viewMode],
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
      {allEntries.length === 0 ? (
        <PanelAppsEmptyGuide
          panelsPath={panelApps.data?.panelsPath}
          onRefresh={() => void panelApps.refetch()}
        />
      ) : entries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">{t('panelAppsEmptyFiltered')}</div>
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

function PanelAppsEmptyGuide({
  panelsPath,
  onRefresh,
}: {
  panelsPath?: string;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-6 text-center">
      <div className="w-full max-w-sm">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <AppWindow className="h-5 w-5" />
        </div>
        <h2 className="mt-3 text-sm font-semibold text-gray-900">{t('panelAppsEmptyTitle')}</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">{t('panelAppsEmptyDescription')}</p>

        <div className="mt-4 space-y-2 text-left">
          <PanelAppsEmptyGuideStep
            icon={<MessageSquarePlus className="h-4 w-4" />}
            title={t('panelAppsEmptyAskTitle')}
            description={t('panelAppsEmptyAskDescription')}
          />
          <PanelAppsEmptyGuideStep
            icon={<FileCode2 className="h-4 w-4" />}
            title={t('panelAppsEmptyFileTitle')}
            description={t('panelAppsEmptyFileDescription')}
          />
        </div>

        {panelsPath ? (
          <div className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-left">
            <div className="text-[11px] font-medium uppercase text-gray-400">{t('panelAppsPanelsPath')}</div>
            <code className="mt-1 block break-all text-xs text-gray-600">{panelsPath}</code>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('panelAppsRefresh')}
        </button>
      </div>
    </div>
  );
}

function PanelAppsEmptyGuideStep({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex gap-2 rounded-md bg-gray-50 px-3 py-2.5">
      <div className="mt-0.5 text-gray-500">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-800">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-gray-500">{description}</div>
      </div>
    </div>
  );
}
