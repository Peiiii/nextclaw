import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nextclawClient } from '@/shared/lib/api';
import type { PanelAppPreferencesUpdateView } from '@/shared/lib/api';

const PANEL_APPS_QUERY_KEY = ['panel-apps'] as const;

export function usePanelApps() {
  return useQuery({
    queryKey: PANEL_APPS_QUERY_KEY,
    queryFn: () => nextclawClient.panelApps.listPanelApps(),
    staleTime: 0,
  });
}

export function useUpdatePanelAppPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      preferences,
    }: {
      id: string;
      preferences: PanelAppPreferencesUpdateView;
    }) => nextclawClient.panelApps.updatePanelAppPreferences(id, preferences),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PANEL_APPS_QUERY_KEY });
    },
  });
}

export function useRecordPanelAppOpened() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => nextclawClient.panelApps.recordPanelAppOpened(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PANEL_APPS_QUERY_KEY });
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
