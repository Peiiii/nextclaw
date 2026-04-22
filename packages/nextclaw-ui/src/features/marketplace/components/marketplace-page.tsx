/* eslint-disable max-lines-per-function */
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
  MarketplacePluginContentView,
  MarketplaceSkillContentView,
  MarketplaceSort,
  MarketplaceItemType,
} from "@/shared/lib/api";
import {
  fetchMarketplacePluginContent,
  fetchMarketplaceSkillContent,
} from "@/shared/lib/api";
import { NoticeCard } from "@/shared/components/ui/notice-card";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { useI18n } from "@/app/components/providers/i18n-provider";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import {
  useInstallMarketplaceItem,
  useManageMarketplaceItem,
  useMarketplaceInstalled,
  useMarketplaceItems,
} from "@/features/marketplace/hooks/use-marketplace";
import {
  FilterPanel,
  MarketplaceListSkeleton,
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
  findInstalledRecordForItem,
  matchInstalledSearch,
  type InstalledRenderEntry,
} from "@/features/marketplace/components/marketplace-page-data";
import { buildGenericDetailDataUrl } from "@/features/marketplace/components/marketplace-detail-doc";
import {
  MarketplaceListCard,
  type InstallState,
  type ManageState,
} from "@/features/marketplace/components/marketplace-list-card";
import { t } from "@/shared/lib/i18n";
import { PageLayout } from "@/app/components/layout/page-layout";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInfiniteScrollLoader } from "@/shared/hooks/use-infinite-scroll-loader";
import { cn } from "@/shared/lib/utils";
import { Sparkles, PackageCheck } from "lucide-react";

const PAGE_SIZE = 12;
const SKELETON_CARD_COUNT = PAGE_SIZE;

type ScopeType = "all" | "installed";

type MarketplaceRouteType = "plugins" | "skills";
type MarketplacePageProps = {
  forcedType?: MarketplaceRouteType;
};

export function MarketplacePage(props: MarketplacePageProps = {}) {
  const { forcedType } = props;
  const navigate = useNavigate();
  const params = useParams<{ type?: string }>();
  const { language } = useI18n();
  const docBrowser = useDocBrowser();

  const routeType: MarketplaceRouteType | null = useMemo(() => {
    if (forcedType === "plugins" || forcedType === "skills") {
      return forcedType;
    }
    if (params.type === "plugins" || params.type === "skills") {
      return params.type;
    }
    return null;
  }, [forcedType, params.type]);

  useEffect(() => {
    if (forcedType) {
      return;
    }
    if (!routeType) {
      navigate("/marketplace/plugins", { replace: true });
    }
  }, [forcedType, routeType, navigate]);

  const typeFilter: MarketplaceItemType =
    routeType === "skills" ? "skill" : "plugin";
  const localeFallbacks = useMemo(
    () => buildLocaleFallbacks(language),
    [language],
  );

  const isPluginModule = typeFilter === "plugin";
  const copyKeys = isPluginModule
    ? {
        pageTitle: "marketplacePluginsPageTitle",
        pageDescription: "marketplacePluginsPageDescription",
        tabMarketplace: "marketplaceTabMarketplacePlugins",
        tabInstalled: "marketplaceTabInstalledPlugins",
        searchPlaceholder: "marketplaceSearchPlaceholderPlugins",
        sectionCatalog: "marketplaceSectionPlugins",
        sectionInstalled: "marketplaceSectionInstalledPlugins",
        errorLoadData: "marketplaceErrorLoadingPluginsData",
        errorLoadInstalled: "marketplaceErrorLoadingInstalledPlugins",
        emptyData: "marketplaceNoPlugins",
        emptyInstalled: "marketplaceNoInstalledPlugins",
        installedCountSuffix: "marketplaceInstalledPluginsCountSuffix",
      }
    : {
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchText.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const installedQuery = useMarketplaceInstalled(typeFilter);

  const itemsQuery = useMarketplaceItems({
    q: query || undefined,
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
    watchValue: `${typeFilter}:${scope}:${query}:${sort}:${itemsQuery.data?.loadedItems ?? 0}:${itemsQuery.data?.loadedPages ?? 0}`,
  });

  useEffect(() => {
    const container = infiniteScroll.containerRef.current;
    if (container && typeof container.scrollTo === "function") {
      container.scrollTo({ top: 0 });
    }
  }, [infiniteScroll.containerRef, query, scope, sort, typeFilter]);

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
  const showCatalogSkeleton =
    scope === "all" && itemsQuery.isLoading && !itemsQuery.data;
  const showInstalledSkeleton =
    scope === "installed" && installedQuery.isLoading && !installedQuery.data;
  const showListSkeleton = showCatalogSkeleton || showInstalledSkeleton;

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

  const scopeTabs = [
    { id: "all", label: t(copyKeys.tabMarketplace), icon: Sparkles },
    {
      id: "installed",
      label: t(copyKeys.tabInstalled),
      icon: PackageCheck,
      count: installedQuery.data?.total ?? 0,
    },
  ] as const;

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
        ...(item.type === "skill"
          ? {
              skill: item.slug,
              installPath: `skills/${item.slug}`,
            }
          : {}),
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
    const targetId = record.id || record.spec;
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

    if (!item) {
      const url = buildGenericDetailDataUrl({
        title,
        typeLabel:
          record?.type === "plugin"
            ? t("marketplaceTypePlugin")
            : t("marketplaceTypeSkill"),
        spec: record?.spec ?? "-",
        summary: t("marketplaceInstalledLocalSummary"),
        metadataRaw: JSON.stringify(record ?? {}, null, 2),
        contentRaw: "-",
      });
      docBrowser.open(url, { newTab: true, title, kind: "content" });
      return;
    }

    const summary = pickLocalizedText(
      item.summaryI18n,
      item.summary,
      localeFallbacks,
    );

    if (item.type === "skill") {
      try {
        const content: MarketplaceSkillContentView =
          await fetchMarketplaceSkillContent(item.slug);
        const url = buildGenericDetailDataUrl({
          title,
          typeLabel: t("marketplaceTypeSkill"),
          spec: item.install.spec,
          summary,
          metadataRaw: content.metadataRaw,
          contentRaw: content.bodyRaw || content.raw,
          sourceUrl: content.sourceUrl,
          sourceLabel: `Source (${content.source})`,
          tags: item.tags,
          author: item.author,
        });
        docBrowser.open(url, { newTab: true, title, kind: "content" });
      } catch (error) {
        const url = buildGenericDetailDataUrl({
          title,
          typeLabel: t("marketplaceTypeSkill"),
          spec: item.install.spec,
          summary,
          metadataRaw: JSON.stringify(
            { error: error instanceof Error ? error.message : String(error) },
            null,
            2,
          ),
          contentRaw: t("marketplaceOperationFailed"),
        });
        docBrowser.open(url, { newTab: true, title, kind: "content" });
      }
      return;
    }

    try {
      const content: MarketplacePluginContentView =
        await fetchMarketplacePluginContent(item.slug);
      const url = buildGenericDetailDataUrl({
        title,
        typeLabel: t("marketplaceTypePlugin"),
        spec: item.install.spec,
        summary,
        metadataRaw: content.metadataRaw,
        contentRaw: content.bodyRaw || content.raw || item.summary,
        sourceUrl: content.sourceUrl,
        sourceLabel: `Source (${content.source})`,
        tags: item.tags,
        author: item.author,
      });
      docBrowser.open(url, { newTab: true, title, kind: "content" });
    } catch (error) {
      const url = buildGenericDetailDataUrl({
        title,
        typeLabel: t("marketplaceTypePlugin"),
        spec: item.install.spec,
        summary,
        metadataRaw: JSON.stringify(
          { error: error instanceof Error ? error.message : String(error) },
          null,
          2,
        ),
        contentRaw: "-",
      });
      docBrowser.open(url, { newTab: true, title, kind: "content" });
    }
  };

  return (
    <PageLayout className="flex h-full min-h-0 flex-col pb-0 px-0">
      <div className="flex flex-col gap-6 w-full max-w-[1400px] h-full min-h-0 mx-auto">
        
        {/* Modern App Store Hero */}
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#020617] px-10 py-14 text-white shadow-xl isolate">
          <div className="absolute top-0 right-0 -m-32 opacity-30 pointer-events-none mix-blend-screen scale-150 transform-gpu">
            <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-indigo-500/40 via-blue-500/30 to-purple-500/20 blur-[80px]"></div>
          </div>
          <div className="absolute bottom-0 left-0 -m-32 opacity-20 pointer-events-none mix-blend-screen transform-gpu">
            <div className="w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-cyan-500/40 to-emerald-500/20 blur-[80px]"></div>
          </div>
          
          <div className="relative z-10 flex flex-col gap-3">
            <h1 className="text-[38px] font-extrabold tracking-[-0.02em] leading-tight drop-shadow-sm text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70">
              {t(copyKeys.pageTitle)}
            </h1>
            <p className="text-[17px] font-medium text-blue-100/70 max-w-2xl leading-relaxed tracking-wide">
              {t(copyKeys.pageDescription)}
            </p>
          </div>
        </div>

        {/* Custom Nav & Filter Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          {/* Custom App Store Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100/60 backdrop-blur-sm rounded-2xl w-fit border border-gray-200/50 shadow-inner">
            {scopeTabs.map((tab) => {
              const isActive = scope === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setScope(tab.id as ScopeType)}
                  className={cn(
                    "relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-[14px] transition-all duration-300",
                    isActive
                      ? "text-gray-900 bg-white shadow-[0_2px_10px_rgb(0,0,0,0.06)]"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/40"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-gray-400")} />
                  {tab.label}
                  {tab.id === 'installed' && typeof tab.count === 'number' && (
                    <span className={cn(
                      "ml-1 flex items-center justify-center h-5 px-1.5 min-w-5 rounded-full text-[11px] font-bold transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-500"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 w-full md:max-w-md">
            <FilterPanel
              scope={scope}
              searchText={searchText}
              searchPlaceholder={t(copyKeys.searchPlaceholder)}
              sort={sort}
              onSearchTextChange={setSearchText}
              onSortChange={setSort}
            />
          </div>
        </div>

        <section className="flex min-h-0 flex-1 flex-col mt-2">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[18px] font-bold tracking-tight text-gray-900 flex items-center gap-2">
              {scope === "installed"
                ? t(copyKeys.sectionInstalled)
                : t(copyKeys.sectionCatalog)}
              <span className="flex items-center justify-center h-6 px-2 rounded-lg bg-gray-100 text-[12px] font-semibold text-gray-500">
                {listSummary}
              </span>
            </h3>
          </div>

          {scope === "all" && itemsQuery.isError && (
            <NoticeCard
              tone="danger"
              title={t(copyKeys.errorLoadData)}
              description={itemsQuery.error.message}
            />
          )}
          {scope === "installed" && installedQuery.isError && (
            <NoticeCard
              tone="danger"
              title={t(copyKeys.errorLoadInstalled)}
              description={installedQuery.error.message}
            />
          )}

          <div
            ref={infiniteScroll.containerRef}
            className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-3 pb-8 -mx-1 px-1"
            aria-busy={showListSkeleton || itemsQuery.isFetchingNextPage}
          >
            <div
              data-testid={
                showListSkeleton ? "marketplace-list-skeleton" : undefined
              }
              className="grid grid-cols-1 gap-[22px] md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 items-stretch"
            >
              {showListSkeleton && (
                <MarketplaceListSkeleton count={SKELETON_CARD_COUNT} />
              )}

              {!showListSkeleton &&
                scope === "all" &&
                allItems.map((item) => (
                  <MarketplaceListCard
                    key={item.id}
                    item={item}
                    record={findInstalledRecordForItem(
                      item,
                      installedRecordLookup,
                    )}
                    language={language}
                    installState={installState}
                    manageState={manageState}
                    onOpen={() =>
                      void openItemDetail(
                        item,
                        findInstalledRecordForItem(item, installedRecordLookup),
                      )
                    }
                    onInstall={handleInstall}
                    onManage={handleManage}
                  />
                ))}

              {!showListSkeleton &&
                scope === "installed" &&
                installedEntries.map((entry) => (
                  <MarketplaceListCard
                    key={entry.key}
                    item={entry.item}
                    record={entry.record}
                    language={language}
                    installState={installState}
                    manageState={manageState}
                    onOpen={() => void openItemDetail(entry.item, entry.record)}
                    onInstall={handleInstall}
                    onManage={handleManage}
                  />
                ))}
            </div>

            {scope === "all" &&
              !showListSkeleton &&
              !itemsQuery.isError &&
              allItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 mt-4">
                  <p className="text-[15px] font-medium text-gray-500">{t(copyKeys.emptyData)}</p>
                </div>
              )}
            {scope === "installed" &&
              !showListSkeleton &&
              !installedQuery.isError &&
              installedEntries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 mt-4">
                  <p className="text-[15px] font-medium text-gray-500">{t(copyKeys.emptyInstalled)}</p>
                </div>
              )}

            {scope === "all" && !showCatalogSkeleton && !itemsQuery.isError && (
              <MarketplaceInfiniteScrollStatus
                hasMore={Boolean(itemsQuery.hasNextPage)}
                loading={itemsQuery.isFetchingNextPage}
                sentinelRef={infiniteScroll.sentinelRef}
              />
            )}
          </div>
        </section>
      </div>
      <ConfirmDialog />
    </PageLayout>
  );
}
