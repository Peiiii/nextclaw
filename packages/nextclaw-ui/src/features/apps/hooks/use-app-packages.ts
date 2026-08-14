import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppPackageOperationStatus, AppPackageOperationView } from '@nextclaw/client-sdk';
import { nextclawClient } from '@/shared/lib/api';
import type { AppPackageOperationSettlementManager } from '@/features/apps/managers/app-package-operation-settlement.manager';
import { APP_DATA_QUERY_KEY } from '@/features/app-data';

const APP_PACKAGES_QUERY_KEY = ['app-packages'] as const;
const PANEL_APPS_QUERY_KEY = ['panel-apps'] as const;
const SERVICE_APPS_QUERY_KEY = ['service-apps'] as const;
const SERVICE_ACTIONS_QUERY_KEY = ['service-actions'] as const;
const APP_PACKAGE_OPERATIONS_QUERY_KEY = ['app-package-operations'] as const;

const ACTIVE_OPERATION_STATUSES = new Set<AppPackageOperationStatus>([
  'queued',
  'resolving',
  'downloading',
  'verifying',
  'installing',
  'finalizing',
]);

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
    queryFn: () => nextclawClient.appPackages.list({ includeStorageUsage: false }),
    staleTime: 0,
  });
}

export function useAppPackageOperations() {
  return useQuery({
    queryKey: APP_PACKAGE_OPERATIONS_QUERY_KEY,
    queryFn: () => nextclawClient.appPackages.listOperations(),
    refetchInterval: (query) => {
      const entries = query.state.data?.entries ?? [];
      return entries.some((entry) => isAppPackageOperationActive(entry.status)) ? 500 : false;
    },
    staleTime: 0,
  });
}

export function isAppPackageOperationActive(status: AppPackageOperationStatus): boolean {
  return ACTIVE_OPERATION_STATUSES.has(status);
}

export function useAppPackageOperationSettlement({
  isLoaded,
  operations,
  refetchPackages,
  refetchPanels,
  refetchAppData,
  settlementManager,
}: {
  isLoaded: boolean;
  operations: AppPackageOperationView[];
  refetchPackages: () => Promise<unknown>;
  refetchPanels: () => Promise<{
    data?: { entries: Array<{ id: string; packageId?: string }> };
  }>;
  refetchAppData: () => Promise<unknown>;
  settlementManager: AppPackageOperationSettlementManager;
}) {
  useEffect(() => {
    settlementManager.settle({
      isLoaded,
      operations,
      refetchPackages,
      refetchPanels,
      refetchAppData,
    });
  }, [isLoaded, operations, refetchPackages, refetchPanels, refetchAppData, settlementManager]);
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
          return await nextclawClient.appPackages.startInstall({
            source: input.source,
            registryUrl: input.registryUrl,
          });
        case 'update':
          return await nextclawClient.appPackages.startUpdate(input.appId);
        case 'rollback':
          return await nextclawClient.appPackages.startRollback(input.appId, input.version);
        case 'uninstall':
          return await nextclawClient.appPackages.startUninstall(
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
        queryClient.invalidateQueries({ queryKey: APP_PACKAGE_OPERATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: APP_DATA_QUERY_KEY }),
      ]);
    },
  });
}
