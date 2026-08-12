import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  appMarketplaceResourceManager,
  type AppMarketplaceResourceSnapshot,
} from "@/features/app-marketplace/managers/app-marketplace-resource.manager.js";
import { appsMarketplaceClient } from "@/features/app-marketplace/services/app-marketplace.service.js";
import type {
  AppItemDetail,
  AppItemSummary,
  AppListResult,
} from "@/features/app-marketplace/types/app-marketplace.types.js";

const HIDDEN_PRODUCT_SLUGS = new Set(["starter-card", "validation-task-board"]);

export function useHomeMarketplace() {
  const loader = useCallback(async () => {
    const result = await appsMarketplaceClient.listApps({
      featured: true,
      limit: 6,
      sort: "featured",
    });
    return productItems(result.items);
  }, []);
  return useMarketplaceResource("home", loader);
}

export function useAppsMarketplace(query: string, tag: string, cursor?: string) {
  const key = `apps:${query}:${tag}:${cursor ?? "first"}`;
  const loader = useCallback(async () => {
    const result = await appsMarketplaceClient.listApps({
      q: query || undefined,
      tag: tag || undefined,
      cursor,
      limit: 24,
      sort: query ? "relevance" : "featured",
    });
    const items = productItems(result.items);
    return { ...result, items };
  }, [cursor, query, tag]);
  return useMarketplaceResource<AppListResult>(key, loader);
}

export function useAppMarketplaceDetail(selector: string) {
  const loader = useCallback(async () => {
    const [app, readme] = await Promise.all([
      appsMarketplaceClient.getApp(selector),
      appsMarketplaceClient.getReadme(selector),
    ]);
    return { app, readme };
  }, [selector]);
  return useMarketplaceResource<{ app: AppItemDetail; readme: string | null }>(
    `detail:${selector}`,
    loader,
    Boolean(selector),
  );
}

export function usePublisherMarketplace(publisherId: string, cursor?: string) {
  const loader = useCallback(async () => {
    const result = await appsMarketplaceClient.listApps({
      publisher: publisherId,
      cursor,
      limit: 24,
      sort: "featured",
    });
    return { ...result, items: productItems(result.items) };
  }, [cursor, publisherId]);
  return useMarketplaceResource<AppListResult>(
    `publisher:${publisherId}:${cursor ?? "first"}`,
    loader,
    Boolean(publisherId),
  );
}

function useMarketplaceResource<T>(
  key: string,
  loader: () => Promise<T>,
  enabled = true,
): AppMarketplaceResourceSnapshot<T> & { retry: () => void } {
  const getSnapshot = useCallback(
    () => appMarketplaceResourceManager.read<T>(key),
    [key],
  );
  const snapshot = useSyncExternalStore(
    appMarketplaceResourceManager.subscribe,
    getSnapshot,
    getSnapshot,
  );
  useEffect(() => {
    if (enabled) void appMarketplaceResourceManager.load(key, loader);
  }, [enabled, key, loader]);
  const retry = useCallback(() => {
    if (enabled) void appMarketplaceResourceManager.reload(key, loader);
  }, [enabled, key, loader]);
  return { ...snapshot, retry };
}

function productItems(items: AppItemSummary[]): AppItemSummary[] {
  return items.filter((item) => !HIDDEN_PRODUCT_SLUGS.has(item.slug));
}
