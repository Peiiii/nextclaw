/* eslint-disable max-lines-per-function */
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
  MarketplaceSkillContentView,
  MarketplaceSort,
  MarketplaceItemType,
} from "@/shared/lib/api";
import { fetchMarketplaceSkillContent } from "@/shared/lib/api";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { useI18n } from "@/app/components/i18n-provider";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import {
  useInstallMarketplaceItem,
  useManageMarketplaceItem,
  useMarketplaceInstalled,
  useMarketplaceItems,
} from "@/features/marketplace/hooks/use-marketplace";
import {
  FilterPanel,
  MarketplaceInfiniteScrollStatus,
} from "@/features/marketplace/components/marketplace-page-parts";
import {
  buildLocaleFallbacks,
  pickLocalizedText,
} from "@/features/marketplace/components/marketplace-localization";
import {
  buildCatalogLookup,
  buildInstalledRecordLookup,
  findCatalogItemForRecord,
  matchInstalledSearch,
  type InstalledRenderEntry,
} from "@/features/marketplace/components/marketplace-page-data";
import { buildGenericDetailDataUrl } from "@/features/marketplace/components/marketplace-detail-doc";
import type {
  InstallState,
  ManageState,
} from "@/features/marketplace/components/marketplace-list-card";
import { MarketplaceCatalogGrid } from "@/features/marketplace/components/marketplace-catalog-grid";
import {
  MarketplaceCuratedSceneView,
  MarketplaceCuratedShelves,
} from "@/features/marketplace/components/curated-shelves/marketplace-curated-shelves";
import { useMarketplaceCuratedSceneRoute } from "@/features/marketplace/hooks/use-marketplace-curated-scene-route";
import { t } from "@/shared/lib/i18n";
import { PageLayout } from "@/app/components/layout/page-layout";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInfiniteScrollLoader } from "@/shared/hooks/use-infinite-scroll-loader";
import { Tabs } from "@/shared/components/ui/tabs-custom";

const PAGE_SIZE = 20;
const SKELETON_CARD_COUNT = 36;

type ScopeType = "all" | "installed";

type MarketplacePageProps = {
  forcedType?: "skills";
};

function getMarketplaceCopyKeys() {
  return {
    pageTitle: "marketplaceSkillsPageTitle",
    pageDescription: "marketplaceSkillsPageDescription",
    tabMarketplace: "marketplaceTabMarketplaceSkills",
    tabInstalled: "marketplaceTabInstalledSkills",
    searchPlaceholder: "marketplaceSearchPlaceholderSkills",
    sectionCatalog: "marketplaceSectionSkills",
    sectionInstalled: "marketplaceSectionInstalledSkills",
    errorLoadData: "marketplaceErrorLoadingSkillsData",
    errorLoadInstalled: "marketplaceErrorLoadingInstalledSkills",
    emptyData: "marketplaceNoSkills",
    emptyInstalled: "marketplaceNoInstalledSkills",
    installedCountSuffix: "marketplaceInstalledSkillsCountSuffix",
  };
}

export function MarketplacePage(props: MarketplacePageProps = {}) {
  const { forcedType } = props;
  const navigate = useNavigate();
  const params = useParams<{ scene?: string }>();
  const { language } = useI18n();
  const docBrowser = useDocBrowser();

  const typeFilter: MarketplaceItemType = "skill";
  const localeFallbacks = useMemo(
    () => buildLocaleFallbacks(language),
    [language],
  );

  const copyKeys = getMarketplaceCopyKeys();

  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeType>("all");
  const [sort, setSort] = useState<MarketplaceSort>("relevance");
  const [installingSpecs, setInstallingSpecs] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [managingTargets, setManagingTargets] = useState<
    ReadonlyMap<string, MarketplaceManageAction>
  >(new Map());
  const detailRequestRef = useRef({ byKey: new Map<string, number>(), seq: 0 });

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

  const infiniteScroll = useInfiniteScrollLoader({
    disabled:
      scope !== "all" ||
      itemsQuery.isError ||
      !itemsQuery.hasNextPage ||
      itemsQuery.isFetchingNextPage,
    onLoadMore: () => itemsQuery.fetchNextPage(),
    watchValue: `${typeFilter}:${scope}:${query}:${sceneParam ?? ""}:${sort}:${itemsQuery.data?.loadedItems ?? 0}:${itemsQuery.data?.loadedPages ?? 0}`,
  });

  useEffect(() => {
    const container = infiniteScroll.containerRef.current;
    if (container && typeof container.scrollTo === "function") {
      container.scrollTo({ top: 0 });
    }
  }, [infiniteScroll.containerRef, query, sceneParam, scope, sort, typeFilter]);

  const installMutation = useInstallMarketplaceItem();
  const manageMutation = useManageMarketplaceItem();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const installedRecords = useMemo(
    () => installedQuery.data?.records ?? [],
    [installedQuery.data?.records],
  );

  const allItems = useMemo(
    () => itemsQuery.data?.items ?? [],
    [itemsQuery.data?.items],
  );

  const catalogLookup = useMemo(() => buildCatalogLookup(allItems), [allItems]);

  const installedRecordLookup = useMemo(
    () => buildInstalledRecordLookup(installedRecords),
    [installedRecords],
  );

  const installedEntries = useMemo<InstalledRenderEntry[]>(() => {
    const entries = installedRecords
      .filter((record) => record.type === typeFilter)
      .map((record) => ({
        key: `${record.type}:${record.spec}:${record.id ?? ""}`,
        record,
        item: findCatalogItemForRecord(record, catalogLookup),
      }))
      .filter((entry) =>
        matchInstalledSearch(entry.record, entry.item, query, localeFallbacks),
      );

    entries.sort((left, right) => {
      const leftTs = left.record.installedAt
        ? Date.parse(left.record.installedAt)
        : Number.NaN;
      const rightTs = right.record.installedAt
        ? Date.parse(right.record.installedAt)
        : Number.NaN;
      const leftValid = !Number.isNaN(leftTs);
      const rightValid = !Number.isNaN(rightTs);

      if (leftValid && rightValid && leftTs !== rightTs) {
        return rightTs - leftTs;
      }

      return left.record.spec.localeCompare(right.record.spec);
    });

    return entries;
  }, [installedRecords, typeFilter, catalogLookup, query, localeFallbacks]);

  const total =
    scope === "installed"
      ? installedEntries.length
      : (itemsQuery.data?.total ?? 0);
  const skeletonState = {
    showCatalog: scope === "all" && itemsQuery.isLoading && !itemsQuery.data,
    showInstalled: scope === "installed" && installedQuery.isLoading && !installedQuery.data,
  };
  const showListSkeleton =
    skeletonState.showCatalog || skeletonState.showInstalled;

  const listSummary = useMemo(() => {
    if (scope === "installed") {
      if (installedQuery.isLoading && !installedQuery.data) {
        return t("loading");
      }
      return `${installedEntries.length} ${t(copyKeys.installedCountSuffix)}`;
    }

    if (!itemsQuery.data) {
      return t("loading");
    }

    return `${allItems.length} / ${total}`;
  }, [
    scope,
    installedQuery.data,
    installedQuery.isLoading,
    installedEntries.length,
    itemsQuery.data,
    allItems.length,
    total,
    copyKeys.installedCountSuffix,
  ]);

  const installState: InstallState = { installingSpecs };

  const manageState: ManageState = {
    actionsByTarget: managingTargets,
  };
  const curatedSceneRoute = useMarketplaceCuratedSceneRoute({
    items: allItems,
    installedRecordLookup,
    scene: sceneParam,
    forcedType,
    typeFilter,
    scope,
    searchText,
    query,
    showListSkeleton,
    hasCatalogError: itemsQuery.isError,
  });

  const handleInstall = async (item: MarketplaceItemSummary) => {
    const installSpec = item.install.spec;
    if (installingSpecs.has(installSpec)) {
      return;
    }

    setInstallingSpecs((prev) => {
      const next = new Set(prev);
      next.add(installSpec);
      return next;
    });

    try {
      await installMutation.mutateAsync({
        type: item.type,
        spec: installSpec,
        kind: item.install.kind,
        skill: item.slug,
        installPath: `skills/${item.slug}`,
      });
    } catch {
      // handled in mutation onError
    } finally {
      setInstallingSpecs((prev) => {
        if (!prev.has(installSpec)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(installSpec);
        return next;
      });
    }
  };

  const handleManage = async (
    action: MarketplaceManageAction,
    record: MarketplaceInstalledRecord,
  ) => {
    const targetId = action === "update"
      ? record.catalogSlug || record.id || record.spec
      : record.id || record.spec;
    if (!targetId) {
      return;
    }
    if (managingTargets.has(targetId)) {
      return;
    }

    if (action === "uninstall") {
      const confirmed = await confirm({
        title: `${t("marketplaceUninstallTitle")} ${targetId}?`,
        description: t("marketplaceUninstallDescription"),
        confirmLabel: t("marketplaceUninstall"),
        variant: "destructive",
      });
      if (!confirmed) {
        return;
      }
    }

    setManagingTargets((previous) => {
      const next = new Map(previous);
      next.set(targetId, action);
      return next;
    });

    try {
      await manageMutation.mutateAsync({
        type: record.type,
        action,
        id: targetId,
        spec: record.spec,
      });
    } finally {
      setManagingTargets((previous) => {
        if (!previous.has(targetId)) {
          return previous;
        }
        const next = new Map(previous);
        next.delete(targetId);
        return next;
      });
    }
  };

  const openItemDetail = async (
    item?: MarketplaceItemSummary,
    record?: MarketplaceInstalledRecord,
  ) => {
    const title =
      item?.name ??
      record?.label ??
      record?.id ??
      record?.spec ??
      t("marketplaceUnknownItem");
    const dedupeKey = item
      ? `marketplace:${item.type}:${item.slug}`
      : `marketplace:${record?.type ?? "unknown"}:${record?.id ?? record?.spec ?? title}`;
    const openOptions = { title, kind: "content" as const, dedupeKey };
    const updateOptions = { ...openOptions, activate: false };

    if (!item) {
      const url = buildGenericDetailDataUrl({
        title,
        typeLabel: t("marketplaceTypeSkill"),
        spec: record?.spec ?? "-",
        summary: t("marketplaceInstalledLocalSummary"),
        metadataRaw: JSON.stringify(record ?? {}, null, 2),
        contentRaw: "-",
      });
      docBrowser.open(url, openOptions);
      return;
    }

    const requestId = detailRequestRef.current.seq + 1;
    detailRequestRef.current.seq = requestId;
    detailRequestRef.current.byKey.set(dedupeKey, requestId);
    const summary = pickLocalizedText(
      item.summaryI18n,
      item.summary,
      localeFallbacks,
    );
    const detailConfig =
      {
        typeLabel: t("marketplaceTypeSkill"),
        loadContent: () => fetchMarketplaceSkillContent(item.slug),
        fallbackContent: t("marketplaceOperationFailed"),
        defaultContent: undefined,
      };
    docBrowser.open(
      buildGenericDetailDataUrl({
        title,
        typeLabel: detailConfig.typeLabel,
        spec: item.install.spec,
        loading: true,
      }),
      openOptions,
    );
    try {
      const content: MarketplaceSkillContentView = await detailConfig.loadContent();
      if (detailRequestRef.current.byKey.get(dedupeKey) !== requestId) {
        return;
      }
      const url = buildGenericDetailDataUrl({
        title,
        typeLabel: detailConfig.typeLabel,
        spec: item.install.spec,
        summary,
        metadataRaw: content.metadataRaw,
        contentRaw: content.bodyRaw || content.raw || detailConfig.defaultContent,
        sourceUrl: content.sourceUrl,
        sourceLabel: `Source (${content.source})`,
        tags: item.tags,
        author: item.author,
      });
      docBrowser.open(url, updateOptions);
    } catch (error) {
      if (detailRequestRef.current.byKey.get(dedupeKey) !== requestId) {
        return;
      }
      const url = buildGenericDetailDataUrl({
        title,
        typeLabel: detailConfig.typeLabel,
        spec: item.install.spec,
        summary,
        metadataRaw: JSON.stringify(
          { error: error instanceof Error ? error.message : String(error) },
          null,
          2,
        ),
        contentRaw: detailConfig.fallbackContent,
      });
      docBrowser.open(url, updateOptions);
    }
  };

  return (
    <PageLayout className="flex h-full min-h-0 flex-col pb-0">
      {!curatedSceneRoute.isSceneRoute && (
        <>
          <Tabs
            tabs={[
              { id: "all", label: t(copyKeys.tabMarketplace) },
              {
                id: "installed",
                label: t(copyKeys.tabInstalled),
                count: installedQuery.data?.total ?? 0,
              },
            ]}
            activeTab={scope}
            onChange={(value) => setScope(value as ScopeType)}
            className="mb-3"
          />

          <FilterPanel
            scope={scope}
            searchText={searchText}
            searchPlaceholder={t(copyKeys.searchPlaceholder)}
            sort={sort}
            onSearchTextChange={setSearchText}
            onSortChange={setSort}
          />
        </>
      )}

      <section className="flex min-h-0 flex-1 flex-col">
        {!curatedSceneRoute.isSceneRoute &&
          !curatedSceneRoute.showShelves &&
          !showListSkeleton && (
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-gray-900">
                {scope === "installed"
                  ? t(copyKeys.sectionInstalled)
                  : language.startsWith("zh") ? "全部技能" : "All Skills"}
              </h3>
              <span className="text-[12px] text-gray-500">{listSummary}</span>
            </div>
          )}

        {scope === "all" && itemsQuery.isError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {t(copyKeys.errorLoadData)}: {itemsQuery.error.message}
          </div>
        )}
        {scope === "installed" && installedQuery.isError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {t(copyKeys.errorLoadInstalled)}: {installedQuery.error.message}
          </div>
        )}

        <div
          ref={infiniteScroll.containerRef}
          className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1"
          aria-busy={showListSkeleton || itemsQuery.isFetchingNextPage}
        >
          {curatedSceneRoute.isSceneRoute && curatedSceneRoute.selectedScene && (
            <MarketplaceCuratedSceneView
              scene={curatedSceneRoute.selectedScene}
              entries={curatedSceneRoute.sceneEntries}
              isLoading={showListSkeleton}
              language={language}
              localeFallbacks={localeFallbacks}
              installState={installState}
              onBack={() => navigate(curatedSceneRoute.backPath)}
              onOpen={(entry) => void openItemDetail(entry.item, entry.record)}
              onInstall={handleInstall}
            />
          )}

          {curatedSceneRoute.showShelves && (
            <MarketplaceCuratedShelves
              entries={curatedSceneRoute.entries}
              scenes={curatedSceneRoute.scenes}
              isScenesLoading={curatedSceneRoute.isScenesLoading}
              isItemsLoading={showListSkeleton}
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
            <MarketplaceCatalogGrid
              scope={scope}
              title={
                scope === "installed"
                  ? t(copyKeys.sectionInstalled)
                  : language.startsWith("zh") ? "全部技能" : "All Skills"
              }
              summary={listSummary}
              showTitle={curatedSceneRoute.showShelves}
              showListSkeleton={showListSkeleton}
              skeletonCardCount={SKELETON_CARD_COUNT}
              allItems={allItems}
              installedEntries={installedEntries}
              installedRecordLookup={installedRecordLookup}
              language={language}
              installState={installState}
              manageState={manageState}
              onOpen={(item, record) => void openItemDetail(item, record)}
              onInstall={handleInstall}
              onManage={handleManage}
            />
          )}

          {scope === "all" &&
            !curatedSceneRoute.isSceneRoute &&
            !showListSkeleton &&
            !itemsQuery.isError &&
            allItems.length === 0 && (
              <div className="py-8 text-center text-[13px] text-gray-500">
                {t(copyKeys.emptyData)}
              </div>
            )}
          {scope === "installed" &&
            !curatedSceneRoute.isSceneRoute &&
            !showListSkeleton &&
            !installedQuery.isError &&
            installedEntries.length === 0 && (
              <div className="py-8 text-center text-[13px] text-gray-500">
                {t(copyKeys.emptyInstalled)}
              </div>
            )}

          {scope === "all" &&
            !showListSkeleton &&
            !itemsQuery.isError && (
              <MarketplaceInfiniteScrollStatus
                hasMore={Boolean(itemsQuery.hasNextPage)}
                loading={itemsQuery.isFetchingNextPage}
                sentinelRef={infiniteScroll.sentinelRef}
              />
            )}
        </div>
      </section>
      <ConfirmDialog />
    </PageLayout>
  );
}
