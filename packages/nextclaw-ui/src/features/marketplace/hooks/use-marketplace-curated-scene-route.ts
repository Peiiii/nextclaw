import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceItemType,
} from "@/shared/lib/api";
import { findInstalledRecordForItem } from "@/features/marketplace/components/marketplace-page-data";
import {
  useMarketplaceSkillSceneCounts,
  useMarketplaceSkillScenes,
} from "@/features/marketplace/hooks/use-marketplace";
import { useMemo } from "react";

type MarketplaceCuratedSceneRouteParams = {
  items: MarketplaceItemSummary[];
  recentItems: MarketplaceItemSummary[];
  installedRecordLookup: Map<string, MarketplaceInstalledRecord>;
  scene?: string;
  forcedType?: "skills";
  typeFilter: MarketplaceItemType;
  scope: "all" | "installed";
  searchText: string;
  query: string;
  showListSkeleton: boolean;
  hasCatalogError: boolean;
};

export function useMarketplaceCuratedSceneRoute(
  params: MarketplaceCuratedSceneRouteParams,
) {
  const {
    items,
    recentItems,
    installedRecordLookup,
    scene,
    forcedType,
    typeFilter,
    scope,
    searchText,
    query,
    showListSkeleton,
    hasCatalogError,
  } = params;
  const scenesQuery = useMarketplaceSkillScenes(typeFilter === "skill");
  const rawScenes = useMemo(
    () => scenesQuery.data?.scenes ?? [],
    [scenesQuery.data?.scenes],
  );
  const fallbackCounts = useMarketplaceSkillSceneCounts(rawScenes, typeFilter === "skill");
  const scenes = useMemo(
    () =>
      rawScenes.map((entry) => ({
        ...entry,
        count: typeof entry.count === "number"
          ? entry.count
          : fallbackCounts.get(entry.scene),
      })),
    [fallbackCounts, rawScenes],
  );
  const entries = useMemo(
    () =>
      items.map((item) => ({
        item,
        record: findInstalledRecordForItem(item, installedRecordLookup),
      })),
    [items, installedRecordLookup],
  );
  const recentEntries = useMemo(
    () =>
      recentItems.map((item) => ({
        item,
        record: findInstalledRecordForItem(item, installedRecordLookup),
      })),
    [installedRecordLookup, recentItems],
  );
  const selectedScene = useMemo(() => {
    const normalizedScene = scene?.trim();
    if (!normalizedScene) {
      return undefined;
    }
    return scenes.find((entry) => entry.scene === normalizedScene) ?? {
      scene: normalizedScene,
      title: normalizedScene,
    };
  }, [scene, scenes]);
  const isSceneRoute = typeFilter === "skill" && Boolean(scene?.trim());
  const isShelfHome =
    typeFilter === "skill" &&
    scope === "all" &&
    !searchText.trim() &&
    !query &&
    !isSceneRoute;
  const hasShelfCatalog = showListSkeleton || items.length >= 4;
  const isScenesLoading =
    isShelfHome &&
    !hasCatalogError &&
    hasShelfCatalog &&
    scenes.length === 0 &&
    scenesQuery.isLoading;
  const showShelves =
    isShelfHome &&
    !hasCatalogError &&
    hasShelfCatalog &&
    (showListSkeleton || scenes.length > 0 || isScenesLoading);

  return {
    entries,
    recentEntries,
    scenes,
    selectedScene,
    sceneEntries: entries,
    isSceneRoute,
    isScenesLoading,
    showShelves,
    backPath: forcedType ? "/skills" : "/marketplace/skills",
    pathPrefix: forcedType ? "/skills/scenes" : "/marketplace/skills/scenes",
  };
}
