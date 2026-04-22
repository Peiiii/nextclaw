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
import { PackageSearch } from "lucide-react";
import type { Ref } from "react";

export function FilterPanel({
  scope,
  searchText,
  searchPlaceholder,
  sort,
  onSearchTextChange,
  onSortChange,
}: {
  scope: "all" | "installed";
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
            className="h-9 w-full rounded-xl border border-gray-200/80 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
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
          className="rounded-2xl border border-gray-200/40 bg-white px-5 py-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3.5">
            <div className="flex min-w-0 flex-1 gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <Skeleton className="h-4 w-32 max-w-[70%]" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            <Skeleton className="h-8 w-20 shrink-0 rounded-xl" />
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
