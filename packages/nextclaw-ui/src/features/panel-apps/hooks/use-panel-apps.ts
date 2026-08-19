import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { nextclawClient } from '@/shared/lib/api';
import type {
  PanelAppEntryView,
  PanelAppListView,
  PanelAppPreferencesUpdateView,
} from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

export const PANEL_APPS_QUERY_KEY = ['panel-apps'] as const;

type PanelAppPreferencesMutation = {
  id: string;
  preferences: PanelAppPreferencesUpdateView;
};

function matchesPanelApp(entry: PanelAppEntryView, id: string): boolean {
  return entry.id === id || entry.appId === id;
}

function updateCachedPanelApp(
  current: PanelAppListView | undefined,
  id: string,
  update: (entry: PanelAppEntryView) => PanelAppEntryView,
): PanelAppListView | undefined {
  if (!current) {
    return current;
  }
  return {
    ...current,
    entries: current.entries.map((entry) => matchesPanelApp(entry, id) ? update(entry) : entry),
  };
}

export function replacePanelAppListEntry(
  current: PanelAppListView | undefined,
  entry: PanelAppEntryView,
): PanelAppListView | undefined {
  return updateCachedPanelApp(current, entry.id, () => entry);
}

function applyOptimisticPreferences(
  current: PanelAppListView | undefined,
  mutation: PanelAppPreferencesMutation,
): PanelAppListView | undefined {
  const nextMainSidebarOrder = current?.entries.reduce(
    (maximum, entry) => Math.max(maximum, entry.mainSidebarOrder ?? -1),
    -1,
  ) ?? -1;
  return updateCachedPanelApp(current, mutation.id, (entry) => ({
    ...entry,
    ...(typeof mutation.preferences.favorite === 'boolean'
      ? { favorite: mutation.preferences.favorite }
      : {}),
    ...(typeof mutation.preferences.mainSidebar === 'boolean'
      ? mutation.preferences.mainSidebar
        ? {
            mainSidebar: true,
            mainSidebarOrder: entry.mainSidebar
              ? entry.mainSidebarOrder
              : nextMainSidebarOrder + 1,
          }
        : { mainSidebar: false, mainSidebarOrder: undefined }
      : {}),
  }));
}

export function usePanelApps(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: PANEL_APPS_QUERY_KEY,
    queryFn: () => nextclawClient.panelApps.listPanelApps(),
    enabled: options.enabled ?? true,
    staleTime: 0,
  });
}

export function useUpdatePanelAppPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, preferences }: PanelAppPreferencesMutation) =>
      nextclawClient.panelApps.updatePanelAppPreferences(id, preferences),
    onMutate: async (mutation) => {
      await queryClient.cancelQueries({ queryKey: PANEL_APPS_QUERY_KEY });
      const previousEntry = queryClient
        .getQueryData<PanelAppListView>(PANEL_APPS_QUERY_KEY)
        ?.entries.find((entry) => matchesPanelApp(entry, mutation.id));
      queryClient.setQueryData<PanelAppListView>(
        PANEL_APPS_QUERY_KEY,
        (current) => applyOptimisticPreferences(current, mutation),
      );
      return { previousEntry };
    },
    onSuccess: (entry) => {
      queryClient.setQueryData<PanelAppListView>(
        PANEL_APPS_QUERY_KEY,
        (current) => replacePanelAppListEntry(current, entry),
      );
    },
    onError: (error, mutation, context) => {
      const previousEntry = context?.previousEntry;
      if (previousEntry) {
        queryClient.setQueryData<PanelAppListView>(
          PANEL_APPS_QUERY_KEY,
          (current) => updateCachedPanelApp(
            current,
            mutation.id,
            () => previousEntry,
          ),
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('panelAppsPreferenceUpdateFailed')}: ${message}`);
    },
  });
}

export function useRecordPanelAppOpened() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => nextclawClient.panelApps.recordPanelAppOpened(id),
    onSuccess: (entry) => {
      queryClient.setQueryData<PanelAppListView>(
        PANEL_APPS_QUERY_KEY,
        (current) => replacePanelAppListEntry(current, entry),
      );
    },
  });
}

export function useGrantPanelAppClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appId: string) => nextclawClient.panelApps.grantClient(appId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PANEL_APPS_QUERY_KEY });
    },
  });
}

export function useDeletePanelApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => nextclawClient.panelApps.deletePanelApp(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PANEL_APPS_QUERY_KEY });
    },
  });
}
