import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
} from "@/shared/lib/api";
import {
  MarketplaceListCard,
  type InstallState,
  type ManageState,
} from "@/features/marketplace/components/marketplace-list-card";
import { cn } from "@/shared/lib/utils";
import type { Ref } from "react";
import {
  MarketplaceInfiniteScrollStatus,
  MarketplaceListSkeleton,
} from "@/features/marketplace/components/marketplace-page-parts";

export type MarketplaceItemListEntry = {
  key: string;
  item?: MarketplaceItemSummary;
  record?: MarketplaceInstalledRecord;
};

export type MarketplaceItemListViewModel = {
  scope: "all" | "installed";
  entries: MarketplaceItemListEntry[];
  header: {
    title: string;
    summary: string;
    refreshingLabel: string;
  };
  status: {
    showSkeleton: boolean;
    isRefreshing: boolean;
    error?: Error;
  };
  emptyLabel: string;
  errorLabel: string;
};

type MarketplaceItemListActions = {
  onOpen: (
    item?: MarketplaceItemSummary,
    record?: MarketplaceInstalledRecord,
  ) => void;
  onInstall: (item: MarketplaceItemSummary) => void;
  onManage: (
    action: MarketplaceManageAction,
    record: MarketplaceInstalledRecord,
  ) => void;
};

export function MarketplaceItemListView({
  model,
  showTitle,
  operationState,
  scroll,
  actions,
}: {
  model: MarketplaceItemListViewModel;
  showTitle: boolean;
  operationState: {
    installState: InstallState;
    manageState: ManageState;
  };
  scroll: {
    hasMore: boolean;
    loadingMore: boolean;
    sentinelRef: Ref<HTMLDivElement>;
  };
  actions: MarketplaceItemListActions;
}) {
  const {
    scope,
    entries,
    header,
    status,
    emptyLabel,
    errorLabel,
  } = model;
  const {
    showSkeleton,
    isRefreshing,
    error,
  } = status;
  const {
    hasMore,
    loadingMore,
    sentinelRef,
  } = scroll;
  const { installState, manageState } = operationState;
  const { onOpen, onInstall, onManage } = actions;

  return (
    <section className={cn("flex min-h-full flex-col", showTitle && "gap-3")}>
      {showTitle && (
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold text-gray-950">
            {header.title}
          </h3>
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            {isRefreshing && (
              <span className="font-medium text-primary">
                {header.refreshingLabel}
              </span>
            )}
            <span>{header.summary}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorLabel}: {error.message}
        </div>
      )}

      {isRefreshing && (
        <div
          data-testid="marketplace-list-refreshing"
          className="h-0.5 overflow-hidden rounded-full bg-primary/10"
        >
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        </div>
      )}

      <div
        data-testid={showSkeleton ? "marketplace-list-skeleton" : undefined}
        className={cn(
          "grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3",
          showSkeleton && "min-h-0 flex-1 auto-rows-[104px] content-start",
        )}
      >
        {showSkeleton && <MarketplaceListSkeleton count={36} />}

        {!showSkeleton &&
          !error &&
          entries.map((entry) => (
            <MarketplaceListCard
              key={entry.key}
              item={entry.item}
              record={entry.record}
              installState={installState}
              manageState={manageState}
              onOpen={() => onOpen(entry.item, entry.record)}
              onInstall={onInstall}
              onManage={onManage}
            />
          ))}
      </div>

      {!showSkeleton && !error && entries.length === 0 && (
        <div className="py-8 text-center text-[13px] text-gray-500">
          {emptyLabel}
        </div>
      )}

      {scope === "all" && !showSkeleton && !error && (
        <MarketplaceInfiniteScrollStatus
          hasMore={hasMore}
          loading={loadingMore}
          sentinelRef={sentinelRef}
        />
      )}
    </section>
  );
}
