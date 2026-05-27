import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nextclawClient } from '@/shared/lib/api';

const SERVICE_APPS_QUERY_KEY = ['service-apps'] as const;
const SERVICE_ACTIONS_QUERY_KEY = ['service-actions'] as const;
const SERVICE_ACTION_GRANTS_QUERY_KEY = ['service-action-grants'] as const;

export function useServiceApps() {
  return useQuery({
    queryKey: SERVICE_APPS_QUERY_KEY,
    queryFn: () => nextclawClient.serviceApps.listServiceApps(),
  });
}

export function useServiceActions() {
  return useQuery({
    queryKey: SERVICE_ACTIONS_QUERY_KEY,
    queryFn: () => nextclawClient.serviceApps.listServiceActions(),
  });
}

export function useServiceActionGrants() {
  return useQuery({
    queryKey: SERVICE_ACTION_GRANTS_QUERY_KEY,
    queryFn: () => nextclawClient.serviceApps.listServiceActionGrants(),
  });
}

export function useRestartServiceApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appId: string) => nextclawClient.serviceApps.restartServiceApp(appId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SERVICE_APPS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SERVICE_ACTIONS_QUERY_KEY }),
      ]);
    },
  });
}

export function useRevokeServiceActionGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      actionId: string;
      caller: { surface: 'panel-app'; appId: string };
    }) => nextclawClient.serviceApps.revokeServiceActionGrant(params),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SERVICE_ACTIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SERVICE_ACTION_GRANTS_QUERY_KEY }),
      ]);
    },
  });
}
