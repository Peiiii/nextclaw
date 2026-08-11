import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nextclawClient } from '@/shared/lib/api';

const APP_PACKAGES_QUERY_KEY = ['app-packages'] as const;
const PANEL_APPS_QUERY_KEY = ['panel-apps'] as const;
const SERVICE_APPS_QUERY_KEY = ['service-apps'] as const;
const SERVICE_ACTIONS_QUERY_KEY = ['service-actions'] as const;

export type AppPackageMutationInput =
  | { action: 'enable'; appId: string }
  | { action: 'disable'; appId: string }
  | { action: 'install'; source: string; registryUrl?: string }
  | { action: 'update'; appId: string }
  | { action: 'rollback'; appId: string; version: string }
  | { action: 'uninstall'; appId: string; purgeData?: boolean };

export function useAppPackages() {
  return useQuery({
    queryKey: APP_PACKAGES_QUERY_KEY,
    queryFn: () => nextclawClient.appPackages.list(),
    staleTime: 0,
  });
}

export function useAppPackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AppPackageMutationInput) => {
      switch (input.action) {
        case 'enable':
          return await nextclawClient.appPackages.enable(input.appId);
        case 'disable':
          return await nextclawClient.appPackages.disable(input.appId);
        case 'install':
          return await nextclawClient.appPackages.install({
            source: input.source,
            registryUrl: input.registryUrl,
          });
        case 'update':
          return await nextclawClient.appPackages.update(input.appId);
        case 'rollback':
          return await nextclawClient.appPackages.rollback(input.appId, input.version);
        case 'uninstall':
          return await nextclawClient.appPackages.uninstall(
            input.appId,
            input.purgeData ?? false,
          );
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: APP_PACKAGES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: PANEL_APPS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SERVICE_APPS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SERVICE_ACTIONS_QUERY_KEY }),
      ]);
    },
  });
}
