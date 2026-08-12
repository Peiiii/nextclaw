import type { AppPackageOperationView, AppPackageView } from '@nextclaw/client-sdk';
import { ChevronRight, Search, Sparkles } from 'lucide-react';
import { AppArtwork } from '@/features/apps/components/app-artwork';
import { AppMarketplaceCover } from '@/features/apps/components/app-marketplace-cover';
import {
  findLatestAppPackageOperation,
  MarketplaceInstallButton,
  OperationProgress,
} from '@/features/apps/components/app-marketplace-operation';
import { isAppPackageOperationActive } from '@/features/apps/hooks/use-app-packages';
import type { AppMarketplaceItemView } from '@/features/apps/types/app-marketplace.types';
import { pickLocalizedText } from '@/features/marketplace';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { getLanguage, t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

export type MarketplaceFilter = 'all' | 'featured' | 'personal' | 'local';

export function AppMarketplaceCatalog({
  error,
  filter,
  installedById,
  isError,
  isFetchingNextPage,
  isLoading,
  isStarting,
  items,
  localeFallbacks,
  onFilterChange,
  onInstall,
  onLoadMore,
  onSearchChange,
  onSelect,
  onUpdate,
  operations,
  hasNextPage,
  search,
  startingSource,
}: {
  error: Error | null;
  filter: MarketplaceFilter;
  installedById: Map<string, AppPackageView>;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isStarting: boolean;
  items: AppMarketplaceItemView[];
  localeFallbacks: string[];
  onFilterChange: (value: MarketplaceFilter) => void;
  onInstall: (source: string, registryUrl: string) => void;
  onLoadMore: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (slug: string) => void;
  onUpdate: (appId: string) => void;
  operations: AppPackageOperationView[];
  hasNextPage: boolean;
  search: string;
  startingSource?: string;
}) {
  return (
    <>
      <MarketplaceCatalogHeader
        filter={filter}
        onFilterChange={onFilterChange}
        onSearchChange={onSearchChange}
        search={search}
      />
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-background px-4 py-4 sm:px-6 sm:py-5">
        {error ? (
          <div role="alert" className="mb-2 rounded-xl bg-destructive/8 px-3 py-2.5 text-xs leading-5 text-destructive ring-1 ring-destructive/15">
            {error.message || t('appPackagesActionFailed')}
          </div>
        ) : null}
        <MarketplaceCatalogContent
          installedById={installedById}
          isError={isError}
          isFetchingNextPage={isFetchingNextPage}
          isLoading={isLoading}
          isStarting={isStarting}
          items={items}
          localeFallbacks={localeFallbacks}
          onInstall={onInstall}
          onLoadMore={onLoadMore}
          onSelect={onSelect}
          onUpdate={onUpdate}
          operations={operations}
          hasNextPage={hasNextPage}
          startingSource={startingSource}
        />
      </div>
    </>
  );
}

function MarketplaceCatalogHeader({
  filter,
  onFilterChange,
  onSearchChange,
  search,
}: {
  filter: MarketplaceFilter;
  onFilterChange: (value: MarketplaceFilter) => void;
  onSearchChange: (value: string) => void;
  search: string;
}) {
  const filters: Array<{ value: MarketplaceFilter; label: string }> = [
    { value: 'all', label: t('appPackagesFilterAll') },
    { value: 'featured', label: t('appPackagesMarketplaceFeatured') },
    { value: 'personal', label: t('appPackagesFilterPersonal') },
    { value: 'local', label: t('appPackagesFilterLocal') },
  ];
  return (
    <div className="shrink-0 border-b border-border/60 bg-card px-5 pb-3.5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
      <DialogHeader className="pr-8">
        <DialogTitle className="text-xl">{t('appPackagesMarketplaceTitle')}</DialogTitle>
        <DialogDescription className="max-w-xl leading-5">
          {t('appPackagesMarketplaceDescription')}
        </DialogDescription>
      </DialogHeader>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          className="h-10 rounded-xl border-transparent bg-muted/65 pl-9 shadow-none focus-visible:ring-1"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('appPackagesMarketplaceSearch')}
          aria-label={t('appPackagesMarketplaceSearch')}
        />
      </div>
      <div className="mt-3 flex gap-1 overflow-x-auto" aria-label={t('appPackagesFilterLabel')}>
        {filters.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => onFilterChange(entry.value)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border',
              filter === entry.value
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-[var(--interaction-hover)] hover:text-foreground',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MarketplaceCatalogContent({
  installedById,
  isError,
  isFetchingNextPage,
  isLoading,
  isStarting,
  items,
  localeFallbacks,
  onInstall,
  onLoadMore,
  onSelect,
  onUpdate,
  operations,
  hasNextPage,
  startingSource,
}: {
  installedById: Map<string, AppPackageView>;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isStarting: boolean;
  items: AppMarketplaceItemView[];
  localeFallbacks: string[];
  onInstall: (source: string, registryUrl: string) => void;
  onLoadMore: () => void;
  onSelect: (slug: string) => void;
  onUpdate: (appId: string) => void;
  operations: AppPackageOperationView[];
  hasNextPage: boolean;
  startingSource?: string;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 min-[820px]:grid-cols-3" aria-label={t('appPackagesMarketplaceLoading')}>
        <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
        <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
        <Skeleton className="hidden aspect-[16/9] w-full rounded-2xl min-[820px]:block" />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">
        {t('appPackagesMarketplaceFailed')}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
          <Search className="h-5 w-5 text-muted-foreground" />
        </span>
        <p className="mt-3 text-sm font-medium text-foreground">{t('appPackagesMarketplaceEmpty')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('appPackagesMarketplaceEmptyHint')}</p>
      </div>
    );
  }
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 min-[820px]:grid-cols-3">
        {items.map((item) => (
          <MarketplaceCatalogCard
            key={item.id}
            installedPackage={installedById.get(item.appId)}
            isStarting={isStarting && startingSource === item.install.spec}
            item={item}
            localeFallbacks={localeFallbacks}
            onInstall={onInstall}
            onSelect={onSelect}
            onUpdate={onUpdate}
            operation={findLatestAppPackageOperation(operations, item.appId, item.install.spec)}
          />
        ))}
      </div>
      {hasNextPage ? (
        <div className="flex justify-center pt-5">
          <button
            type="button"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
            className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition hover:bg-[var(--interaction-hover)] disabled:cursor-wait disabled:opacity-60"
          >
            {isFetchingNextPage ? t('appPackagesMarketplaceLoadingMore') : t('appPackagesMarketplaceLoadMore')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MarketplaceCatalogCard({
  installedPackage,
  isStarting,
  item,
  localeFallbacks,
  onInstall,
  onSelect,
  onUpdate,
  operation,
}: {
  installedPackage?: AppPackageView;
  isStarting: boolean;
  item: AppMarketplaceItemView;
  localeFallbacks: string[];
  onInstall: (source: string, registryUrl: string) => void;
  onSelect: (slug: string) => void;
  onUpdate: (appId: string) => void;
  operation?: AppPackageOperationView;
}) {
  const displayName = installedPackage
    ? readLocalizedText(installedPackage.name, installedPackage.nameI18n)
    : item.name;
  const summary = pickLocalizedText(item.summaryI18n, item.summary, localeFallbacks);
  const active = operation ? isAppPackageOperationActive(operation.status) : false;
  const failed = operation?.status === 'failed' || operation?.status === 'interrupted';
  const canUpdate = Boolean(
    installedPackage && installedPackage.activeVersion !== item.latestVersion,
  );
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg">
      <button
        type="button"
        onClick={() => onSelect(item.slug)}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <AppMarketplaceCover accentColor={item.accentColor} coverPreview={item.coverPreview} coverUrl={item.coverUrl} name={displayName} className="aspect-[16/9] rounded-none ring-0" />
      </button>
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <AppArtwork icon={item.iconUrl ?? installedPackage?.icon} name={displayName} className="h-11 w-11 rounded-[13px]" />
          <button
            type="button"
            onClick={() => onSelect(item.slug)}
            className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
              {item.featured ? <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label={t('appPackagesMarketplaceFeatured')} /> : null}
            </span>
            <span className="mt-1 line-clamp-2 block min-h-10 text-xs leading-5 text-muted-foreground">{summary}</span>
            <span className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/75">
              <span>{item.publisher.name}</span>
              <span aria-hidden="true">·</span>
              <span>v{item.latestVersion}</span>
              <ChevronRight className="ml-0.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
            </span>
          </button>
        </div>
        <div className="mt-3 flex items-center justify-end border-t border-border/50 pt-3">
          <MarketplaceInstallButton
            active={active}
            canUpdate={canUpdate}
            failed={failed}
            installed={Boolean(installedPackage)}
            isStarting={isStarting}
            onAction={() => canUpdate
              ? onUpdate(item.appId)
              : onInstall(item.install.spec, item.install.registry)}
            operation={operation}
          />
        </div>
      </div>
      {operation && (active || failed) ? <div className="px-4 pb-4"><OperationProgress operation={operation} /></div> : null}
    </article>
  );
}

function readLocalizedText(
  fallback: string | undefined,
  localized: Record<string, string> | undefined,
): string {
  const languageTag = getLanguage() === 'zh' ? 'zh-CN' : 'en-US';
  return localized?.[languageTag] ?? fallback ?? '';
}
