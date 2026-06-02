import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';
import {
  applyInstallResultToInstalledView,
  applyManageResultToInstalledView
} from '@/features/marketplace/utils/marketplace-installed-cache.utils';
import {
  fetchMarketplaceItem,
  fetchMarketplaceInstalled,
  fetchMarketplaceItems,
  fetchMarketplaceRecommendations,
  fetchMarketplaceSkillScenes,
  installMarketplaceItem,
  manageMarketplaceItem,
  type MarketplaceListParams
} from '@/shared/lib/api';
import type {
  MarketplaceInstallRequest,
  MarketplaceInstalledView,
  MarketplaceItemType,
  MarketplaceManageRequest,
  MarketplaceSceneView
} from '@/shared/lib/api';
import { collapseMarketplaceListPages } from '@/features/marketplace/utils/marketplace-list-pages.utils';
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
      return previousType === params.type && hasSameMarketplaceListIdentity(
        previousParams as MarketplaceListParams,
        params
      )
        ? previousData
        : undefined;
    },
    staleTime: 15_000
  });

  const data = useMemo(() => collapseMarketplaceListPages(query.data), [query.data]);

  return {
    ...query,
    data
  };
}

function hasSameMarketplaceListIdentity(
  previousParams: MarketplaceListParams,
  nextParams: MarketplaceListParams
): boolean {
  return previousParams.q === nextParams.q
    && previousParams.tag === nextParams.tag
    && previousParams.scene === nextParams.scene
    && previousParams.sort === nextParams.sort
    && previousParams.pageSize === nextParams.pageSize;
}

export function useMarketplaceRecommendations(type: MarketplaceItemType, params: { scene?: string; limit?: number }) {
  return useQuery({
    queryKey: ['marketplace-recommendations', type, params],
    queryFn: () => fetchMarketplaceRecommendations(type, params),
    staleTime: 30_000
  });
}

export function useMarketplaceSkillScenes(enabled = true) {
  return useQuery({
    queryKey: ['marketplace-skill-scenes'],
    queryFn: fetchMarketplaceSkillScenes,
    enabled,
    staleTime: 60_000
  });
}

export function useMarketplaceSkillSceneCounts(
  scenes: MarketplaceSceneView[],
  enabled = true
) {
  const queries = useQueries({
    queries: scenes.map((scene) => ({
      queryKey: ['marketplace-skill-scene-count', scene.scene],
      queryFn: () => fetchMarketplaceItems({
        type: 'skill',
        scene: scene.scene,
        pageSize: 1
      }),
      enabled: enabled && typeof scene.count !== 'number',
      staleTime: 60_000
    }))
  });

  return useMemo(() => {
    const counts = new Map<string, number>();
    scenes.forEach((scene, index) => {
      const knownCount = typeof scene.count === 'number' ? scene.count : queries[index]?.data?.total;
      if (typeof knownCount === 'number') {
        counts.set(scene.scene, knownCount);
      }
    });
    return counts;
  }, [queries, scenes]);
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
      toast.success(result.message || t('marketplaceInstallSuccessSkill'));
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
      const fallback = result.action === 'enable'
        ? t('marketplaceEnableSuccess')
        : result.action === 'disable'
          ? t('marketplaceDisableSuccess')
          : result.action === 'update'
            ? t('marketplaceUpdateSuccess')
            : t('marketplaceUninstallSuccess');
      toast.success(result.message || fallback);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('marketplaceOperationFailed'));
    }
  });
}
