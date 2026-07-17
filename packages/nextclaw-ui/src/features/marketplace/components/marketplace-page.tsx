import type {
  MarketplaceSort,
  MarketplaceItemType,
} from "@/shared/lib/api";
import { useI18n } from "@/app/components/i18n-provider";
import {
  useMarketplaceInstalled,
  useMarketplaceItems,
  useMarketplaceRecentItems,
} from "@/features/marketplace/hooks/use-marketplace";
import {
  FilterPanel,
  MarketplaceInfiniteScrollStatus,
} from "@/features/marketplace/components/marketplace-page-parts";
import {
  buildLocaleFallbacks,
} from "@/features/marketplace/components/marketplace-localization";
import { MarketplaceItemListView } from "@/features/marketplace/components/marketplace-item-list-view";
import {
  MarketplaceCuratedSceneView,
  MarketplaceCuratedShelves,
} from "@/features/marketplace/components/curated-shelves/marketplace-curated-shelves";
import { MarketplaceExternalSkillSourceAction } from "@/features/marketplace/components/marketplace-external-skill-source-action";
import { useMarketplaceCuratedSceneRoute } from "@/features/marketplace/hooks/use-marketplace-curated-scene-route";
import { useMarketplaceItemActions } from "@/features/marketplace/hooks/use-marketplace-item-actions";
import { useMarketplaceItemDetail } from "@/features/marketplace/hooks/use-marketplace-item-detail";
import { useMarketplaceListModel } from "@/features/marketplace/hooks/use-marketplace-list-model";
import { t } from "@/shared/lib/i18n";
import { PageLayout } from "@/app/components/layout/page-layout";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInfiniteScrollLoader } from "@/shared/hooks/use-infinite-scroll-loader";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

const PAGE_SIZE = 20;
type ScopeType = "all" | "installed";

export function MarketplacePage({
  forcedType,
}: { forcedType?: "skills" } = {}) {
  const navigate = useNavigate();
  const params = useParams<{ scene?: string }>();
  const { language } = useI18n();

  const typeFilter: MarketplaceItemType = "skill";
  const localeFallbacks = useMemo(
    () => buildLocaleFallbacks(language),
    [language],
  );

  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeType>("all");
  const [sort, setSort] = useState<MarketplaceSort>("relevance");
  const {
    installState,
    manageState,
    handleInstall,
    handleManage,
    ConfirmDialog,
  } = useMarketplaceItemActions();
  const { openItemDetail } = useMarketplaceItemDetail(localeFallbacks);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchText.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const installedQuery = useMarketplaceInstalled(typeFilter);
  const sceneParam = typeFilter === "skill" ? params.scene?.trim() : undefined;

  const itemsQuery = useMarketplaceItems({
    q: sceneParam ? undefined : query || undefined,
    scene: sceneParam,
    type: typeFilter,
    sort,
    pageSize: PAGE_SIZE,
  });
  const recentItemsQuery = useMarketplaceRecentItems(
    typeFilter,
    scope === "all" && !searchText.trim() && !query && !sceneParam,
  );

  const {
    containerRef: listContainerRef,
    sentinelRef: listSentinelRef,
  } = useInfiniteScrollLoader({
    disabled:
      scope !== "all" ||
      itemsQuery.isError ||
      !itemsQuery.hasNextPage ||
      itemsQuery.isFetchingNextPage,
    onLoadMore: () => itemsQuery.fetchNextPage(),
    watchValue: `${typeFilter}:${scope}:${query}:${sceneParam ?? ""}:${sort}:${itemsQuery.data?.loadedItems ?? 0}:${itemsQuery.data?.loadedPages ?? 0}`,
  });

  useEffect(() => {
    const container = listContainerRef.current;
    if (container && typeof container.scrollTo === "function") {
      container.scrollTo({ top: 0 });
    }
  }, [listContainerRef, query, sceneParam, scope, sort, typeFilter]);

  const listModel = useMarketplaceListModel({
    scope,
    typeFilter,
    query,
    localeFallbacks,
    catalogView: itemsQuery.data,
    installedView: installedQuery.data,
    isCatalogLoading: itemsQuery.isLoading,
    isCatalogFetching: itemsQuery.isFetching,
    isCatalogFetchingNextPage: itemsQuery.isFetchingNextPage,
    catalogError: itemsQuery.isError ? itemsQuery.error : undefined,
    isInstalledLoading: installedQuery.isLoading,
    installedError: installedQuery.isError ? installedQuery.error : undefined,
  });

  const curatedSceneRoute = useMarketplaceCuratedSceneRoute({
    items: listModel.allItems,
    recentItems: recentItemsQuery.data?.items ?? [],
    installedRecordLookup: listModel.installedRecordLookup,
    scene: sceneParam,
    forcedType,
    typeFilter,
    scope,
    searchText,
    query,
    showListSkeleton: listModel.showListSkeleton,
    hasCatalogError: itemsQuery.isError,
  });

  return (
    <PageLayout className="flex h-full min-h-0 flex-col pb-0">
      {!curatedSceneRoute.isSceneRoute && (
        <>
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-gray-200/60">
            <Tabs
              value={scope}
              onValueChange={(value) => setScope(value as ScopeType)}
            >
              <TabsList className="mb-0 h-auto flex-1 justify-start gap-6 rounded-none border-b-0 bg-transparent p-0 text-gray-500">
                <TabsTrigger
                  value="all"
                  className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 shadow-none hover:bg-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-gray-950 data-[state=active]:shadow-none"
                >
                  {t("marketplaceTabMarketplaceSkills")}
                </TabsTrigger>
                <TabsTrigger
                  value="installed"
                  className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 shadow-none hover:bg-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-gray-950 data-[state=active]:shadow-none"
                >
                  {t("marketplaceTabInstalledSkills")}
                  <span className="text-[11px] font-medium text-gray-500">
                    {listModel.installedTotal}
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <MarketplaceExternalSkillSourceAction />
          </div>

          <FilterPanel
            scope={scope}
            searchText={searchText}
            isRefreshing={listModel.isRefreshingList}
            searchPlaceholder={t("marketplaceSearchPlaceholderSkills")}
            sort={sort}
            onSearchTextChange={setSearchText}
            onSortChange={setSort}
          />
        </>
      )}

      <section className="flex min-h-0 flex-1 flex-col">
        <div
          ref={listContainerRef}
          className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1"
          aria-busy={listModel.showListSkeleton || itemsQuery.isFetchingNextPage}
        >
          {curatedSceneRoute.isSceneRoute &&
            curatedSceneRoute.selectedScene && (
              <MarketplaceCuratedSceneView
                scene={curatedSceneRoute.selectedScene}
                entries={curatedSceneRoute.sceneEntries}
                isLoading={listModel.showListSkeleton}
                language={language}
                localeFallbacks={localeFallbacks}
                installState={installState}
                onBack={() => navigate(curatedSceneRoute.backPath)}
                onOpen={(entry) =>
                  void openItemDetail(entry.item, entry.record)
                }
                onInstall={handleInstall}
              />
            )}

          {curatedSceneRoute.isSceneRoute && !listModel.showListSkeleton && (
            <MarketplaceInfiniteScrollStatus
              hasMore={Boolean(itemsQuery.hasNextPage)}
              loading={itemsQuery.isFetchingNextPage}
              sentinelRef={listSentinelRef}
            />
          )}

          {curatedSceneRoute.showShelves && (
            <MarketplaceCuratedShelves
              recentEntries={curatedSceneRoute.recentEntries}
              scenes={curatedSceneRoute.scenes}
              isScenesLoading={curatedSceneRoute.isScenesLoading}
              isItemsLoading={
                listModel.showListSkeleton || recentItemsQuery.isLoading
              }
              language={language}
              installState={installState}
              onOpen={(entry) => void openItemDetail(entry.item, entry.record)}
              onInstall={handleInstall}
              onOpenScene={(scene) =>
                navigate(`${curatedSceneRoute.pathPrefix}/${scene}`)
              }
            />
          )}

          {!curatedSceneRoute.isSceneRoute && (
            <MarketplaceItemListView
              model={listModel.itemListView}
              showTitle={
                curatedSceneRoute.showShelves || !listModel.showListSkeleton
              }
              operationState={{
                installState,
                manageState,
              }}
              scroll={{
                hasMore: Boolean(itemsQuery.hasNextPage),
                loadingMore: itemsQuery.isFetchingNextPage,
                sentinelRef: listSentinelRef,
              }}
              actions={{
                onOpen: (item, record) => void openItemDetail(item, record),
                onInstall: handleInstall,
                onManage: handleManage,
              }}
            />
          )}
        </div>
      </section>
      <ConfirmDialog />
    </PageLayout>
  );
}
