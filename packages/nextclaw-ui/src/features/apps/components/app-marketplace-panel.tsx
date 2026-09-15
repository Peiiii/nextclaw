import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { AppPackageHostTarget, AppPackageOperationView, AppPackageView } from '@nextclaw/client-sdk';
import { ArrowLeft } from 'lucide-react';
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
  getAppMarketplaceInstallabilityRank,
  resolveAppMarketplaceInstallability,
} from '@/features/apps/utils/app-marketplace-platform.utils';
import { Button } from '@/shared/components/ui/button';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { getLanguage, t } from '@/shared/lib/i18n';

const HIDDEN_ENGINEERING_APPS = new Set([
  'nextclaw.starter-card',
  'nextclaw.validation-task-board',
]);

export function AppMarketplacePanel({
  error,
  hostTarget,
  installedPackages,
  isStarting,
  onInstall,
  onCustomInstall,
  onManagePackage,
  sourceButtonRef,
  onUpdate,
  active,
  operations,
  startingSource,
}: {
  error: Error | null;
  hostTarget?: AppPackageHostTarget;
  installedPackages: AppPackageView[];
  isStarting: boolean;
  onInstall: (source: string, registryUrl: string) => void;
  onCustomInstall: () => void;
  onManagePackage: (appId: string) => void;
  sourceButtonRef: RefObject<HTMLButtonElement>;
  onUpdate: (appId: string) => void;
  active: boolean;
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
  const marketplace = useAppMarketplace(marketplaceParams, active);
  const detail = useAppMarketplaceDetail(selectedSlug, active);
  const installedById = useMemo(
    () => new Map(installedPackages.map((entry) => [entry.id, entry])),
    [installedPackages],
  );
  const localeFallbacks = buildLocaleFallbacks(getLanguage() === 'zh' ? 'zh-CN' : 'en-US');
  const items = useMemo(() => (marketplace.data?.items ?? [])
    .filter((item) => !HIDDEN_ENGINEERING_APPS.has(item.appId))
    .map((item, index) => ({
      item,
      index,
      rank: getAppMarketplaceInstallabilityRank(
        resolveAppMarketplaceInstallability(item.availability, hostTarget),
      ),
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ item }) => item), [hostTarget, marketplace.data?.items]);

  const selectedTrigger = useRef<HTMLElement | null>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const selectItem = (slug: string) => {
    selectedTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedSlug(slug);
  };
  const backToCatalog = () => {
    setSelectedSlug(null);
    requestAnimationFrame(() => selectedTrigger.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    if (selectedSlug) backButton.current?.focus();
  }, [selectedSlug]);

  return (
    <TooltipProvider>
      <div className="[container-type:inline-size] flex h-full min-h-0 flex-col bg-card">
        {selectedSlug ? (
          <>
            <div className="shrink-0 border-b border-border/50 px-4 py-3">
              <Button ref={backButton} type="button" variant="ghost" size="sm" onClick={backToCatalog}>
                <ArrowLeft className="mr-2 h-4 w-4" />{t('appPackagesBackToMarketplace')}
              </Button>
            </div>
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-background">
                {error ? <p role="alert" className="mx-5 mt-4 text-sm text-destructive">{error.message || t('appPackagesActionFailed')}</p> : null}
              <MarketplaceDetail
                detail={detail.data}
                error={detail.error instanceof Error ? detail.error : null}
                installedPackage={detail.data ? installedById.get(detail.data.appId) : undefined}
                hostTarget={hostTarget}
                isLoading={detail.isLoading}
                isStarting={isStarting && detail.data?.install.spec === startingSource}
                localeFallbacks={localeFallbacks}
                onInstall={onInstall}
                onUpdate={onUpdate}
                onManagePackage={onManagePackage}
                operation={detail.data
                  ? findLatestAppPackageOperation(operations, detail.data.appId, detail.data.install.spec)
                  : undefined}
              />
            </div>
          </>
        ) : null}
        <div hidden={Boolean(selectedSlug)} className={selectedSlug ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
          <AppMarketplaceCatalog
            error={error}
            filter={filter}
            installedById={installedById}
            hostTarget={hostTarget}
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
            onSelect={selectItem}
            onCustomInstall={onCustomInstall}
            sourceButtonRef={sourceButtonRef}
            onManagePackage={onManagePackage}
            onRetry={() => void marketplace.refetch()}
            onUpdate={onUpdate}
            operations={operations}
            hasNextPage={marketplace.hasNextPage}
            search={search}
            startingSource={startingSource}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
