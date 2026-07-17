import type {
  MarketplaceInstalledView,
  MarketplaceItemType,
  MarketplaceListView,
} from "@/shared/lib/api";
import type {
  MarketplaceItemListEntry,
  MarketplaceItemListViewModel,
} from "@/features/marketplace/components/marketplace-item-list-view";
import {
  buildCatalogLookup,
  buildInstalledRecordLookup,
  findCatalogItemForRecord,
  findInstalledRecordForItem,
  matchInstalledSearch,
} from "@/features/marketplace/components/marketplace-page-data";
import { useMemo } from "react";
import { t } from "@/shared/lib/i18n";

type MarketplaceListModelParams = {
  scope: "all" | "installed";
  typeFilter: MarketplaceItemType;
  query: string;
  localeFallbacks: string[];
  catalogView?: MarketplaceListView;
  installedView?: MarketplaceInstalledView;
  isCatalogLoading: boolean;
  isCatalogFetching: boolean;
  isCatalogFetchingNextPage: boolean;
  catalogError?: Error | null;
  isInstalledLoading: boolean;
  installedError?: Error | null;
};

export function useMarketplaceListModel(params: MarketplaceListModelParams) {
  const {
    scope,
    typeFilter,
    query,
    localeFallbacks,
    catalogView,
    installedView,
    isCatalogLoading,
    isCatalogFetching,
    isCatalogFetchingNextPage,
    catalogError,
    isInstalledLoading,
    installedError,
  } = params;
  const installedRecords = useMemo(
    () => installedView?.records ?? [],
    [installedView?.records],
  );
  const allItems = useMemo(() => catalogView?.items ?? [], [catalogView?.items]);
  const catalogLookup = useMemo(() => buildCatalogLookup(allItems), [allItems]);
  const installedRecordLookup = useMemo(
    () => buildInstalledRecordLookup(installedRecords),
    [installedRecords],
  );
  const installedEntries = useMemo(
    () =>
      installedRecords
        .filter((record) => record.type === typeFilter)
        .map((record) => ({
          key: `${record.type}:${record.spec}:${record.id ?? ""}`,
          record,
          item: findCatalogItemForRecord(record, catalogLookup),
        }))
        .filter((entry) =>
          matchInstalledSearch(
            entry.record,
            entry.item,
            query,
            localeFallbacks,
          ),
        )
        .sort((left, right) => compareInstalledRecords(left.record, right.record)),
    [installedRecords, typeFilter, catalogLookup, query, localeFallbacks],
  );
  const listEntries = useMemo<MarketplaceItemListEntry[]>(
    () =>
      scope === "installed"
        ? installedEntries
        : allItems.map((item) => ({
            key: item.id,
            item,
            record: findInstalledRecordForItem(item, installedRecordLookup),
          })),
    [allItems, installedEntries, installedRecordLookup, scope],
  );
  const showListSkeleton =
    (scope === "all" && isCatalogLoading && !catalogView) ||
    (scope === "installed" && isInstalledLoading && !installedView);
  const isRefreshingList =
    scope === "all" &&
    !showListSkeleton &&
    Boolean(catalogView) &&
    isCatalogFetching &&
    !isCatalogFetchingNextPage;
  const listSummary =
    scope === "installed"
      ? isInstalledLoading && !installedView
        ? t("loading")
        : `${installedEntries.length} ${t("marketplaceInstalledSkillsCountSuffix")}`
      : catalogView
        ? `${catalogView.total} ${t("marketplaceSkillsCountSuffix")}`
        : t("loading");
  const error =
    scope === "all" && catalogError
      ? catalogError
      : scope === "installed" && installedError
        ? installedError
        : undefined;

  const itemListView: MarketplaceItemListViewModel = {
    scope,
    entries: listEntries,
    header: {
      title:
        scope === "installed"
          ? t("marketplaceSectionInstalledSkills")
          : t("marketplaceAllSkills"),
      summary: listSummary,
      refreshingLabel: t("marketplaceRefreshingResults"),
    },
    status: {
      showSkeleton: showListSkeleton,
      isRefreshing: isRefreshingList,
      error,
    },
    emptyLabel:
      scope === "installed"
        ? t("marketplaceNoInstalledSkills")
        : t("marketplaceNoSkills"),
    errorLabel:
      scope === "installed"
        ? t("marketplaceErrorLoadingInstalledSkills")
        : t("marketplaceErrorLoadingSkillsData"),
  };

  return {
    allItems,
    installedRecordLookup,
    installedTotal: installedView?.total ?? 0,
    itemListView,
    showListSkeleton,
    isRefreshingList,
  };
}

function compareInstalledRecords(
  left: { installedAt?: string; spec: string },
  right: { installedAt?: string; spec: string },
) {
  const leftTs = Date.parse(left.installedAt ?? "");
  const rightTs = Date.parse(right.installedAt ?? "");
  return Number.isNaN(leftTs) || Number.isNaN(rightTs) || leftTs === rightTs
    ? left.spec.localeCompare(right.spec)
    : rightTs - leftTs;
}
