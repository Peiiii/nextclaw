import type { MarketplaceSort } from '@/shared/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { t } from '@/shared/lib/i18n';
import { Search } from 'lucide-react';
import type { Ref } from 'react';
import { cn } from '@/shared/lib/utils';

export function FilterPanel(props: {
  scope: 'all' | 'installed';
  searchText: string;
  searchPlaceholder: string;
  sort: MarketplaceSort;
  onSearchTextChange: (value: string) => void;
  onSortChange: (value: MarketplaceSort) => void;
}) {
  return (
    <div className="mb-6 xl:mb-8 pt-2">
      <div className="flex flex-col sm:flex-row gap-4 items-center max-w-4xl">
        <div className="flex-1 w-full min-w-0 relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 group-focus-within:text-primary transition-colors">
            <Search className="h-[18px] w-[18px]" />
          </div>
          <input
            value={props.searchText}
            onChange={(event) => props.onSearchTextChange(event.target.value)}
            placeholder={props.searchPlaceholder}
            className={cn(
              "w-full h-12 bg-white/60 backdrop-blur-md border border-gray-200/80 rounded-2xl pl-11 pr-4",
              "text-[15px] font-medium text-gray-900 placeholder:text-gray-400 placeholder:font-normal",
              "focus:outline-none focus:ring-[3px] focus:ring-primary/10 focus:border-primary/40 focus:bg-white bg-clip-padding",
              "transition-all shadow-sm hover:bg-white hover:border-gray-300/80"
            )}
          />
        </div>

        {props.scope === 'all' && (
          <Select value={props.sort} onValueChange={(value) => props.onSortChange(value as MarketplaceSort)}>
            <SelectTrigger className="h-12 w-full sm:w-[160px] shrink-0 rounded-2xl bg-white/60 backdrop-blur-md border-gray-200/80 hover:bg-white transition-all focus:ring-[3px] focus:ring-primary/10 shadow-sm font-medium text-[14px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="relevance" className="rounded-lg cursor-pointer">{t('marketplaceSortRelevance')}</SelectItem>
              <SelectItem value="updated" className="rounded-lg cursor-pointer">{t('marketplaceSortUpdated')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

export function MarketplaceListSkeleton(props: {
  count: number;
}) {
  return (
    <>
      {Array.from({ length: props.count }, (_, index) => (
        <article
          key={`marketplace-skeleton-${index}`}
          className="flex flex-col justify-between gap-4 rounded-[20px] bg-white px-5 py-5 border border-gray-950/[0.04] shadow-sm transform-gpu"
        >
          <div className="flex min-w-0 items-start gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-[14px]" />
            <div className="min-w-0 flex-1 space-y-2.5 pt-1">
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <div className="flex items-center gap-2 mt-1">
                <Skeleton className="h-3 w-12 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-5/6 rounded" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-auto border-t border-gray-100/80 pt-3">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </article>
      ))}
    </>
  );
}

export function MarketplaceInfiniteScrollStatus(props: {
  hasMore: boolean;
  loading: boolean;
  sentinelRef: Ref<HTMLDivElement>;
}) {
  if (!props.hasMore && !props.loading) {
    return null;
  }

  return (
    <div className="py-8 flex items-center justify-center relative">
      {props.hasMore && <div ref={props.sentinelRef} className="absolute bottom-40 h-1 w-full" aria-hidden="true" />}
      {props.loading && (
        <div data-testid="marketplace-loading-more" className="text-[13px] font-semibold text-gray-500 bg-white shadow-sm border border-gray-200/60 px-5 py-2 rounded-full animate-pulse transition-opacity">
          {t('loading')}
        </div>
      )}
    </div>
  );
}
