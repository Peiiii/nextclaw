import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';
import {
  applyInstallResultToInstalledView,
  applyManageResultToInstalledView
} from '@/components/marketplace/marketplace-installed-cache';
import {
  fetchMarketplaceItem,
  fetchMarketplaceInstalled,
  fetchMarketplaceItems,
  fetchMarketplaceRecommendations,
  installMarketplaceItem,
  manageMarketplaceItem,
  type MarketplaceListParams
} from '@/api/marketplace';
import type {
  MarketplaceInstallRequest,
  MarketplaceInstalledView,
  MarketplaceItemType,
  MarketplaceManageRequest
} from '@/api/types';
import { collapseMarketplaceListPages } from '@/hooks/marketplace-list-pages';
import { useMemo } from 'react';

export function useMarketplaceItems(params: MarketplaceListParams) {
  const query = useInfiniteQuery({
    queryKey: ['marketplace-items', params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchMarketplaceItems({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    placeholderData: (previousData, previousQuery) => {
      const previousParams = previousQuery?.queryKey?.[1];
      if (!previousParams || typeof previousParams !== 'object' || previousParams === null) {
        return undefined;
      }

      const previousType = 'type' in previousParams ? previousParams.type : undefined;
      return previousType === params.type ? previousData : undefined;
    },
    staleTime: 15_000
  });

  const data = useMemo(() => collapseMarketplaceListPages(query.data), [query.data]);

  return {
    ...query,
    data
  };
}

export function useMarketplaceRecommendations(type: MarketplaceItemType, params: { scene?: string; limit?: number }) {
  return useQuery({
    queryKey: ['marketplace-recommendations', type, params],
    queryFn: () => fetchMarketplaceRecommendations(type, params),
    staleTime: 30_000
  });
}

export function useMarketplaceItem(slug: string | null, type?: MarketplaceItemType) {
  return useQuery({
    queryKey: ['marketplace-item', slug, type],
    queryFn: () => fetchMarketplaceItem(slug as string, type as MarketplaceItemType),
    enabled: Boolean(slug && type),
    staleTime: 30_000
  });
}

export function useMarketplaceInstalled(type: MarketplaceItemType) {
  return useQuery({
    queryKey: ['marketplace-installed', type],
    queryFn: () => fetchMarketplaceInstalled(type),
    staleTime: 10_000
  });
}

export function useInstallMarketplaceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: MarketplaceInstallRequest) => installMarketplaceItem(request),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<MarketplaceInstalledView | undefined>(
        ['marketplace-installed', result.type],
        (view) => applyInstallResultToInstalledView({
          view,
          request: variables,
          result
        })
      );
      queryClient.invalidateQueries({
        queryKey: ['marketplace-installed', result.type],
        refetchType: 'inactive'
      });
      if (result.type === 'plugin') {
        queryClient.invalidateQueries({ queryKey: ['ncp-session-types'] });
      }
      const fallback = result.type === 'plugin'
        ? t('marketplaceInstallSuccessPlugin')
        : t('marketplaceInstallSuccessSkill');
      toast.success(result.message || fallback);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('marketplaceInstallFailed'));
    }
  });
}

export function useManageMarketplaceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: MarketplaceManageRequest) => manageMarketplaceItem(request),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<MarketplaceInstalledView | undefined>(
        ['marketplace-installed', result.type],
        (view) => applyManageResultToInstalledView({
          view,
          request: variables,
          result
        })
      );
      queryClient.invalidateQueries({
        queryKey: ['marketplace-installed', result.type],
        refetchType: 'inactive'
      });
      if (result.type === 'plugin') {
        queryClient.invalidateQueries({ queryKey: ['ncp-session-types'] });
      }
      const fallback = result.action === 'enable'
        ? t('marketplaceEnableSuccess')
        : result.action === 'disable'
          ? t('marketplaceDisableSuccess')
          : t('marketplaceUninstallSuccess');
      toast.success(result.message || fallback);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('marketplaceOperationFailed'));
    }
  });
}
