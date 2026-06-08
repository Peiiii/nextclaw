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
import { MarketplaceListSkeleton } from "@/features/marketplace/components/marketplace-page-parts";
import {
  findInstalledRecordForItem,
  type InstalledRenderEntry,
} from "@/features/marketplace/components/marketplace-page-data";
import { cn } from "@/shared/lib/utils";

type MarketplaceCatalogGridProps = {
  scope: "all" | "installed";
  title: string;
  summary: string;
  refreshingLabel: string;
  showTitle: boolean;
  showListSkeleton: boolean;
  isRefreshing: boolean;
  skeletonCardCount: number;
  allItems: MarketplaceItemSummary[];
  installedEntries: InstalledRenderEntry[];
  installedRecordLookup: Map<string, MarketplaceInstalledRecord>;
  language: string;
  installState: InstallState;
  manageState: ManageState;
  onOpen: (item?: MarketplaceItemSummary, record?: MarketplaceInstalledRecord) => void;
  onInstall: (item: MarketplaceItemSummary) => void;
  onManage: (
    action: MarketplaceManageAction,
    record: MarketplaceInstalledRecord,
  ) => void;
};

export function MarketplaceCatalogGrid(props: MarketplaceCatalogGridProps) {
  const {
    scope,
    title,
    summary,
    refreshingLabel,
    showTitle,
    showListSkeleton,
    isRefreshing,
    skeletonCardCount,
    allItems,
    installedEntries,
    installedRecordLookup,
    language,
    installState,
    manageState,
    onOpen,
    onInstall,
    onManage,
  } = props;

  return (
    <section className={cn("flex min-h-full flex-col", showTitle && "gap-3")}>
      {showTitle && (
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold text-gray-950">{title}</h3>
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            {isRefreshing && (
              <span className="font-medium text-primary">{refreshingLabel}</span>
            )}
            <span>{summary}</span>
          </div>
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
        data-testid={showListSkeleton ? "marketplace-list-skeleton" : undefined}
        className={cn(
          "grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3",
          showListSkeleton && "min-h-0 flex-1 auto-rows-[104px] content-start",
        )}
      >
        {showListSkeleton && (
          <MarketplaceListSkeleton count={skeletonCardCount} />
        )}

        {!showListSkeleton &&
          scope === "all" &&
          allItems.map((item) => (
            <MarketplaceListCard
              key={item.id}
              item={item}
              record={findInstalledRecordForItem(item, installedRecordLookup)}
              language={language}
              installState={installState}
              manageState={manageState}
              onOpen={() =>
                onOpen(item, findInstalledRecordForItem(item, installedRecordLookup))
              }
              onInstall={onInstall}
              onManage={onManage}
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
              onOpen={() => onOpen(entry.item, entry.record)}
              onInstall={onInstall}
              onManage={onManage}
            />
          ))}
      </div>
    </section>
  );
}
