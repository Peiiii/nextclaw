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

type MarketplaceCatalogGridProps = {
  scope: "all" | "installed";
  title: string;
  summary: string;
  showTitle: boolean;
  showListSkeleton: boolean;
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
    showTitle,
    showListSkeleton,
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
    <section className={showTitle ? "space-y-3" : ""}>
      {showTitle && (
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold text-gray-950">{title}</h3>
          <span className="text-[12px] text-gray-500">{summary}</span>
        </div>
      )}

      <div
        data-testid={showListSkeleton ? "marketplace-list-skeleton" : undefined}
        className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3"
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
