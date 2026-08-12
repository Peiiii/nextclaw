import { useEffect, useMemo, useState } from 'react';
import type { AppPackageOperationView, AppPackageView } from '@nextclaw/client-sdk';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import {
  AppMarketplaceCatalog,
  type MarketplaceFilter,
} from '@/features/apps/components/app-marketplace-catalog';
import { MarketplaceDetail } from '@/features/apps/components/app-marketplace-detail';
import { findLatestAppPackageOperation } from '@/features/apps/components/app-marketplace-operation';
import {
  useAppMarketplace,
  useAppMarketplaceDetail,
} from '@/features/apps/hooks/use-app-marketplace';
import { buildLocaleFallbacks } from '@/features/marketplace';
import {
  Dialog,
  DialogContent,
} from '@/shared/components/ui/dialog';
import { getLanguage, t } from '@/shared/lib/i18n';

const HIDDEN_ENGINEERING_APPS = new Set([
  'nextclaw.starter-card',
  'nextclaw.validation-task-board',
]);

export function AppMarketplaceDialog({
  error,
  installedPackages,
  isStarting,
  onInstall,
  onOpenChange,
  onUpdate,
  open,
  operations,
  startingSource,
}: {
  error: Error | null;
  installedPackages: AppPackageView[];
  isStarting: boolean;
  onInstall: (source: string, registryUrl: string) => void;
  onOpenChange: (open: boolean) => void;
  onUpdate: (appId: string) => void;
  open: boolean;
  operations: AppPackageOperationView[];
  startingSource?: string;
}) {
  const [filter, setFilter] = useState<MarketplaceFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const marketplaceParams = useMemo(() => ({
    q: debouncedSearch || undefined,
    featured: filter === 'featured' ? true : undefined,
    tags: filter === 'personal'
      ? ['personal', 'productivity', 'notes', 'calendar']
      : undefined,
    tag: filter === 'local'
        ? 'local'
        : undefined,
    sort: debouncedSearch ? 'relevance' as const : 'featured' as const,
  }), [debouncedSearch, filter]);
  const marketplace = useAppMarketplace(marketplaceParams, open);
  const detail = useAppMarketplaceDetail(selectedSlug, open);
  const installedById = useMemo(
    () => new Map(installedPackages.map((entry) => [entry.id, entry])),
    [installedPackages],
  );
  const localeFallbacks = buildLocaleFallbacks(getLanguage() === 'zh' ? 'zh-CN' : 'en-US');
  const items = useMemo(
    () => (marketplace.data?.items ?? []).filter(
      (item) => !HIDDEN_ENGINEERING_APPS.has(item.appId),
    ),
    [marketplace.data?.items],
  );

  const closeDialog = (nextOpen: boolean) => {
    if (!nextOpen) setSelectedSlug(null);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="flex h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 p-0 shadow-[0_32px_100px_rgba(0,0,0,0.24)] backdrop-blur-xl [&>button.absolute]:top-[max(1rem,env(safe-area-inset-top))] sm:h-[min(680px,calc(100dvh-4rem))] sm:w-[min(920px,calc(100vw-3rem))] sm:max-w-none sm:rounded-2xl sm:border sm:border-border/55">
        {selectedSlug ? (
          <>
            <MarketplaceDetailHeader onBack={() => setSelectedSlug(null)} />
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-background">
              <MarketplaceDetail
                detail={detail.data}
                error={detail.error instanceof Error ? detail.error : null}
                installedPackage={detail.data ? installedById.get(detail.data.appId) : undefined}
                isLoading={detail.isLoading}
                isStarting={isStarting && detail.data?.install.spec === startingSource}
                localeFallbacks={localeFallbacks}
                onInstall={onInstall}
                onUpdate={onUpdate}
                operation={detail.data
                  ? findLatestAppPackageOperation(operations, detail.data.appId, detail.data.install.spec)
                  : undefined}
              />
            </div>
          </>
        ) : (
          <AppMarketplaceCatalog
            error={error}
            filter={filter}
            installedById={installedById}
            isError={marketplace.isError}
            isFetchingNextPage={marketplace.isFetchingNextPage}
            isLoading={marketplace.isLoading}
            isStarting={isStarting}
            items={items}
            localeFallbacks={localeFallbacks}
            onFilterChange={setFilter}
            onInstall={onInstall}
            onLoadMore={() => void marketplace.fetchNextPage()}
            onSearchChange={setSearch}
            onSelect={setSelectedSlug}
            onUpdate={onUpdate}
            operations={operations}
            hasNextPage={marketplace.hasNextPage}
            search={search}
            startingSource={startingSource}
          />
        )}
        <div className="flex items-start gap-2 border-t border-border/60 bg-muted/25 px-5 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 text-[11px] leading-4 text-muted-foreground sm:px-6 sm:pb-3">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t('appPackagesMarketplaceTrustHint')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MarketplaceDetailHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="border-b border-border/60 bg-card px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('appPackagesBackToMarketplace')}
      </button>
    </div>
  );
}
