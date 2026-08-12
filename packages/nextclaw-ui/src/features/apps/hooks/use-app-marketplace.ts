import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  fetchAppMarketplace,
  fetchAppMarketplaceDetail,
  withDevPreviewCover,
} from '@/features/apps/services/app-marketplace.service';
import type {
  AppMarketplaceCatalogParams,
  AppMarketplaceItemView,
  AppMarketplaceListView,
} from '@/features/apps/types/app-marketplace.types';

export { fetchAppMarketplace, withDevPreviewCover };
export type {
  AppMarketplaceCatalogParams,
  AppMarketplaceCatalogView,
  AppMarketplaceDetailView,
  AppMarketplaceItemView,
  AppMarketplaceListView,
} from '@/features/apps/types/app-marketplace.types';

const APP_MARKETPLACE_QUERY_KEY = ['app-marketplace', 'v3'] as const;

export function useAppMarketplace(params: AppMarketplaceCatalogParams, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: [...APP_MARKETPLACE_QUERY_KEY, params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => await fetchAppMarketplace({
      ...params,
      cursor: pageParam,
      limit: 24,
    }, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
  const data = useMemo<AppMarketplaceListView | undefined>(() => {
    if (!query.data) {
      return undefined;
    }
    const byId = new Map<string, AppMarketplaceItemView>();
    for (const page of query.data.pages) {
      for (const item of page.items) {
        byId.set(item.id, item);
      }
    }
    return {
      items: [...byId.values()],
      hasMore: query.data.pages.at(-1)?.hasMore ?? false,
    };
  }, [query.data]);
  return { ...query, data };
}

export function useAppMarketplaceDetail(slug: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['app-marketplace-detail', 'v2', slug],
    queryFn: async ({ signal }) => await fetchAppMarketplaceDetail(slug ?? '', signal),
    enabled: enabled && Boolean(slug),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}
