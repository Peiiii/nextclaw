import type { MarketplaceSort } from "@/shared/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { t } from "@/shared/lib/i18n";
import { Loader2, PackageSearch } from "lucide-react";
import type { Ref } from "react";

export function FilterPanel({
  scope,
  isRefreshing,
  searchText,
  searchPlaceholder,
  sort,
  onSearchTextChange,
  onSortChange,
}: {
  scope: "all" | "installed";
  isRefreshing: boolean;
  searchText: string;
  searchPlaceholder: string;
  sort: MarketplaceSort;
  onSearchTextChange: (value: string) => void;
  onSortChange: (value: MarketplaceSort) => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <PackageSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-xl border border-border/75 bg-card pl-9 pr-9 text-sm transition-colors focus:outline-none focus:ring-0 focus:border-border"
          />
          {isRefreshing && (
            <Loader2
              className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-primary"
              aria-label={t("marketplaceRefreshingResults")}
            />
          )}
        </div>

        {scope === "all" && (
          <Select
            value={sort}
            onValueChange={(value) => onSortChange(value as MarketplaceSort)}
          >
            <SelectTrigger className="h-9 w-[150px] shrink-0 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">
                {t("marketplaceSortRelevance")}
              </SelectItem>
              <SelectItem value="updated">
                {t("marketplaceSortUpdated")}
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

export function MarketplaceListSkeleton({ count }: {
  count: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <article
          key={`marketplace-skeleton-${index}`}
          className="h-full rounded-xl border border-gray-200/60 bg-white p-3.5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex min-w-0 flex-1 gap-2.5">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32 max-w-[70%]" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-full" />
                <div className="flex gap-1.5 pt-0.5">
                  <Skeleton className="h-5 w-14 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-12 rounded-md" />
                </div>
              </div>
            </div>
            <Skeleton className="h-7 w-16 shrink-0 rounded-md" />
          </div>
        </article>
      ))}
    </>
  );
}

export function MarketplaceInfiniteScrollStatus({
  hasMore,
  loading,
  sentinelRef,
}: {
  hasMore: boolean;
  loading: boolean;
  sentinelRef: Ref<HTMLDivElement>;
}) {
  if (!hasMore && !loading) {
    return null;
  }

  return (
    <div className="py-4">
      {hasMore && <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />}
      {loading && (
        <div
          data-testid="marketplace-loading-more"
          className="pt-3 text-center text-xs text-gray-500"
        >
          {t("loading")}
        </div>
      )}
    </div>
  );
}
