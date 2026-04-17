/* eslint-disable max-lines-per-function */
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
  MarketplacePluginContentView,
  MarketplaceSkillContentView,
  MarketplaceSort,
  MarketplaceItemType,
} from "@/api/types";
import {
  fetchMarketplacePluginContent,
  fetchMarketplaceSkillContent,
} from "@/api/marketplace";
import { NoticeCard } from "@/components/ui/notice-card";
import { Tabs } from "@/components/ui/tabs-custom";
import { useDocBrowser } from "@/components/doc-browser";
import { useI18n } from "@/components/providers/I18nProvider";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  useInstallMarketplaceItem,
  useManageMarketplaceItem,
  useMarketplaceInstalled,
  useMarketplaceItems,
} from "@/hooks/useMarketplace";
import {
  FilterPanel,
  MarketplaceListSkeleton,
  MarketplaceInfiniteScrollStatus,
} from "@/components/marketplace/marketplace-page-parts";
import {
  buildLocaleFallbacks,
  pickLocalizedText,
} from "@/components/marketplace/marketplace-localization";
import {
  buildCatalogLookup,
  buildInstalledRecordLookup,
  findCatalogItemForRecord,
  findInstalledRecordForItem,
  matchInstalledSearch,
  type InstalledRenderEntry,
} from "@/components/marketplace/marketplace-page-data";
import { buildGenericDetailDataUrl } from "@/components/marketplace/marketplace-detail-doc";
import {
  MarketplaceListCard,
  type InstallState,
  type ManageState,
} from "@/components/marketplace/marketplace-list-card";
import { t } from "@/lib/i18n";
import { PageLayout, PageHeader } from "@/components/layout/page-layout";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInfiniteScrollLoader } from "@/hooks/use-infinite-scroll-loader";

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
    { id: "all", label: t(copyKeys.tabMarketplace) },
    {
      id: "installed",
      label: t(copyKeys.tabInstalled),
      count: installedQuery.data?.total ?? 0,
    },
  ];

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
    <PageLayout className="flex h-full min-h-0 flex-col pb-0">
      <PageHeader
        title={t(copyKeys.pageTitle)}
        description={t(copyKeys.pageDescription)}
      />

      <Tabs
        tabs={scopeTabs}
        activeTab={scope}
        onChange={(value) => setScope(value as ScopeType)}
        className="mb-4"
      />

      <FilterPanel
        scope={scope}
        searchText={searchText}
        searchPlaceholder={t(copyKeys.searchPlaceholder)}
        sort={sort}
        onSearchTextChange={setSearchText}
        onSortChange={setSort}
      />

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-gray-900">
            {scope === "installed"
              ? t(copyKeys.sectionInstalled)
              : t(copyKeys.sectionCatalog)}
          </h3>
          <span className="text-[12px] text-gray-500">{listSummary}</span>
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
          className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1"
          aria-busy={showListSkeleton || itemsQuery.isFetchingNextPage}
        >
          <div
            data-testid={
              showListSkeleton ? "marketplace-list-skeleton" : undefined
            }
            className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3"
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
              <div className="text-[13px] text-gray-500 py-8 text-center">
                {t(copyKeys.emptyData)}
              </div>
            )}
          {scope === "installed" &&
            !showListSkeleton &&
            !installedQuery.isError &&
            installedEntries.length === 0 && (
              <div className="text-[13px] text-gray-500 py-8 text-center">
                {t(copyKeys.emptyInstalled)}
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
      <ConfirmDialog />
    </PageLayout>
  );
}
