import { useRef, type RefObject } from 'react';
import type { AppPackageHostTarget, AppPackageOperationView, AppPackageView } from '@nextclaw/client-sdk';
import { ChevronRight, Search, Sparkles, PackagePlus, X } from 'lucide-react';
import { AppArtwork } from '@/features/apps/components/app-artwork';
import { AppMarketplaceCover } from '@/features/apps/components/app-marketplace-cover';
import {
  findLatestAppPackageOperation,
  MarketplaceCompatibilityBadge,
  MarketplaceCompatibilityStatus,
  MarketplaceInstallButton,
  OperationProgress,
  readMarketplaceCompatibilityPresentation,
} from '@/features/apps/components/app-marketplace-operation';
import { isAppPackageOperationActive } from '@/features/apps/hooks/use-app-packages';
import type { AppMarketplaceItemView } from '@/features/apps/types/app-marketplace.types';
import {
  formatAppMarketplacePlatforms,
  resolveAppMarketplaceInstallability,
} from '@/features/apps/utils/app-marketplace-platform.utils';
import { pickLocalizedText } from '@/features/marketplace';
import { Button } from '@/shared/components/ui/button';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Input } from '@/shared/components/ui/input';
import { SkeletonContent } from '@/shared/components/ui/skeleton';
import { getLanguage, t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

export type MarketplaceFilter = 'all' | 'featured' | 'personal' | 'local';

export function AppMarketplaceCatalog({
  error,
  onCustomInstall,
  sourceButtonRef,
  filter,
  hostTarget,
  installedById,
  isError,
  onRetry,
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
  onManagePackage,
  operations,
  hasNextPage,
  search,
  startingSource,
}: {
  error: Error | null;
  onCustomInstall?: () => void;
  sourceButtonRef?: RefObject<HTMLButtonElement>;
  filter: MarketplaceFilter;
  hostTarget?: AppPackageHostTarget;
  installedById: Map<string, AppPackageView>;
  isError: boolean;
  onRetry?: () => void;
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
  onManagePackage?: (appId: string) => void;
  operations: AppPackageOperationView[];
  hasNextPage: boolean;
  search: string;
  startingSource?: string;
}) {
  const scrollArea = useRef<HTMLDivElement>(null);
  return (
    <>
      <MarketplaceCatalogHeader
        onCustomInstall={onCustomInstall}
        sourceButtonRef={sourceButtonRef}
        filter={filter}
        onFilterChange={(value) => { if (scrollArea.current) scrollArea.current.scrollTop = 0; onFilterChange(value); }}
        onSearchChange={(value) => { if (scrollArea.current) scrollArea.current.scrollTop = 0; onSearchChange(value); }}
        search={search}
      />
      <div ref={scrollArea} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5 [@container(min-width:40rem)]:px-6">
        {error ? (
          <div role="alert" className="mb-2 rounded-xl bg-destructive/8 px-3 py-2.5 text-xs leading-5 text-destructive ring-1 ring-destructive/15">
            {error.message || t('appPackagesActionFailed')}
          </div>
        ) : null}
        <MarketplaceCatalogContent
          installedById={installedById}
          hostTarget={hostTarget}
          isError={isError}
          onRetry={onRetry}
          isFetchingNextPage={isFetchingNextPage}
          isLoading={isLoading}
          isStarting={isStarting}
          items={items}
          localeFallbacks={localeFallbacks}
          onInstall={onInstall}
          onLoadMore={onLoadMore}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onManagePackage={onManagePackage}
          operations={operations}
          hasNextPage={hasNextPage}
          startingSource={startingSource}
        />
      </div>
    </>
  );
}

function MarketplaceCatalogHeader({
  onCustomInstall,
  sourceButtonRef,
  filter,
  onFilterChange,
  onSearchChange,
  search,
}: {
  onCustomInstall?: () => void;
  sourceButtonRef?: RefObject<HTMLButtonElement>;
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
    <div className="shrink-0 border-b border-border/60 bg-card px-4 pb-4 pt-5 [@container(min-width:40rem)]:px-6">
      <div className="mx-auto max-w-[872px]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t('appPackagesMarketplaceTitle')}</h1>
        {onCustomInstall ? <IconActionButton ref={sourceButtonRef} icon={<PackagePlus className="h-4 w-4" />} label={t('appPackagesCustomSource')} onClick={onCustomInstall} /> : null}
      </div>
      <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{t('appPackagesMarketplaceDescription')}</p>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-10 rounded-xl border-0 bg-muted/65 pl-9 pr-10 ![box-shadow:none]"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('appPackagesMarketplaceSearch')}
          aria-label={t('appPackagesMarketplaceSearch')}
        />
        {search ? <div className="absolute right-1 top-1/2 -translate-y-1/2"><IconActionButton icon={<X className="h-3.5 w-3.5" />} label={t('appPackagesClearSearch')} onClick={() => onSearchChange('')} /></div> : null}
      </div>
      <div className="custom-scrollbar mt-3 flex gap-1 overflow-x-auto" aria-label={t('appPackagesFilterLabel')}>
        {filters.map((entry) => (
          <button
            key={entry.value}
            type="button"
            aria-pressed={filter === entry.value}
            onClick={() => onFilterChange(entry.value)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border',
              filter === entry.value
                ? 'bg-[var(--interaction-selection)] text-foreground'
                : 'text-muted-foreground hover:bg-[var(--interaction-hover)] hover:text-foreground',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

function MarketplaceCatalogContent({
  installedById,
  hostTarget,
  isError,
  onRetry,
  isFetchingNextPage,
  isLoading,
  isStarting,
  items,
  localeFallbacks,
  onInstall,
  onLoadMore,
  onSelect,
  onUpdate,
  onManagePackage,
  operations,
  hasNextPage,
  startingSource,
}: {
  installedById: Map<string, AppPackageView>;
  hostTarget?: AppPackageHostTarget;
  isError: boolean;
  onRetry?: () => void;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isStarting: boolean;
  items: AppMarketplaceItemView[];
  localeFallbacks: string[];
  onInstall: (source: string, registryUrl: string) => void;
  onLoadMore: () => void;
  onSelect: (slug: string) => void;
  onUpdate: (appId: string) => void;
  onManagePackage?: (appId: string) => void;
  operations: AppPackageOperationView[];
  hasNextPage: boolean;
  startingSource?: string;
}) {
  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-[872px] gap-4 [@container(min-width:36rem)]:grid-cols-2 [@container(min-width:52rem)]:grid-cols-3" role="status" aria-label={t('appPackagesMarketplaceLoading')}>
        <SkeletonContent />
        <SkeletonContent />
        <SkeletonContent className="hidden [@container(min-width:52rem)]:flex" />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">
        {t('appPackagesMarketplaceFailed')}
        {onRetry ? <Button className="mt-3 block" variant="outline" size="sm" onClick={onRetry}>{t('appPackagesRefresh')}</Button> : null}
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
    <div className="mx-auto w-full max-w-[872px]">
      <div className="grid gap-1 [@container(min-width:36rem)]:gap-4 [@container(min-width:36rem)]:grid-cols-2 [@container(min-width:52rem)]:grid-cols-3">
        {items.map((item) => (
          <MarketplaceCatalogCard
            key={item.id}
            installedPackage={installedById.get(item.appId)}
            hostTarget={hostTarget}
            isStarting={isStarting && startingSource === item.install.spec}
            item={item}
            localeFallbacks={localeFallbacks}
            onInstall={onInstall}
            onSelect={onSelect}
            onUpdate={onUpdate}
            onManagePackage={onManagePackage}
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
  hostTarget,
  isStarting,
  item,
  localeFallbacks,
  onInstall,
  onSelect,
  onUpdate,
  onManagePackage,
  operation,
}: {
  installedPackage?: AppPackageView;
  hostTarget?: AppPackageHostTarget;
  isStarting: boolean;
  item: AppMarketplaceItemView;
  localeFallbacks: string[];
  onInstall: (source: string, registryUrl: string) => void;
  onSelect: (slug: string) => void;
  onUpdate: (appId: string) => void;
  onManagePackage?: (appId: string) => void;
  operation?: AppPackageOperationView;
}) {
  const displayName = installedPackage
    ? readLocalizedText(installedPackage.name, installedPackage.nameI18n)
    : item.name;
  const summary = pickLocalizedText(item.summaryI18n, item.summary, localeFallbacks);
  const active = operation ? isAppPackageOperationActive(operation.status) : false;
  const canUpdate = Boolean(
    installedPackage && installedPackage.activeVersion !== item.latestVersion,
  );
  const supportedPlatforms = formatAppMarketplacePlatforms(
    item.availability,
    t('appPackagesAllPlatforms'),
  );
  const compatibility = readMarketplaceCompatibilityPresentation(
    resolveAppMarketplaceInstallability(item.availability, hostTarget),
    supportedPlatforms,
  );
  const blockAction = Boolean(compatibility && (!installedPackage || canUpdate));
  return (
    <article className="group relative overflow-hidden rounded-lg bg-card transition-colors duration-150 hover:bg-[var(--interaction-hover)] [@container(min-width:36rem)]:rounded-2xl [@container(min-width:36rem)]:border [@container(min-width:36rem)]:border-border/60 [@container(min-width:36rem)]:shadow-sm">
      <button
        type="button"
        onClick={() => onSelect(item.slug)}
        aria-label={displayName}
        className="hidden w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [@container(min-width:36rem)]:block"
      >
        <AppMarketplaceCover icon={item.iconUrl ?? installedPackage?.icon} accentColor={item.accentColor} coverPreview={item.coverPreview} coverUrl={item.coverUrl} name={displayName} className="aspect-[16/9] rounded-none ring-0" />
      </button>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 px-2 py-3 [@container(min-width:36rem)]:block [@container(min-width:36rem)]:p-3.5">
        <div className="flex min-w-0 items-start gap-2.5">
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
            <MarketplaceCompatibilityBadge presentation={compatibility} />
            <span className="mt-1 block truncate text-xs leading-5 text-muted-foreground [@container(min-width:36rem)]:line-clamp-2 [@container(min-width:36rem)]:min-h-10 [@container(min-width:36rem)]:whitespace-normal">{summary}</span>
            <span className="mt-1 flex items-center gap-1.5 overflow-hidden text-[11px] text-muted-foreground [@container(min-width:36rem)]:mt-2 [@container(min-width:36rem)]:flex-wrap">
              <span className="truncate">{item.publisher.name}</span>
              <span aria-hidden="true" className="hidden [@container(min-width:36rem)]:inline">·</span>
              <span className="hidden [@container(min-width:36rem)]:inline">v{item.latestVersion}</span>
              <span aria-hidden="true" className="hidden [@container(min-width:36rem)]:inline">·</span>
              <span className="hidden [@container(min-width:36rem)]:inline">{supportedPlatforms}</span>
              <ChevronRight className="ml-0.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
            </span>
          </button>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 [@container(min-width:36rem)]:mt-3 [@container(min-width:36rem)]:border-t [@container(min-width:36rem)]:border-border/50 [@container(min-width:36rem)]:pt-3">
          <MarketplaceCompatibilityStatus
            blocked={blockAction}
            presentation={compatibility}
            className="hidden min-w-0 text-[11px] font-medium text-muted-foreground [@container(min-width:36rem)]:block"
          />
          <MarketplaceInstallButton
            onInstalled={onManagePackage ? () => onManagePackage(item.appId) : undefined}
            active={active}
            canUpdate={canUpdate}
            installed={Boolean(installedPackage)}
            isStarting={isStarting}
            onAction={() => canUpdate
              ? onUpdate(item.appId)
              : onInstall(item.install.spec, item.install.registry)}
            operation={operation}
            unavailableLabel={blockAction ? compatibility?.actionLabel : undefined}
            unavailableReason={blockAction ? compatibility?.reason : undefined}
          />
        </div>
      </div>
      {operation && !blockAction && (active || operation.status === 'failed' || operation.status === 'interrupted') ? <div className="px-4 pb-4"><OperationProgress operation={operation} /></div> : null}
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
