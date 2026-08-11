import { useMemo, useState } from 'react';
import type { AppPackageView } from '@nextclaw/client-sdk';
import { AppWindow, Check, ExternalLink, Search, ShieldCheck } from 'lucide-react';
import { useAppMarketplace } from '@/features/apps/hooks/use-app-marketplace';
import {
  buildLocaleFallbacks,
  pickLocalizedText,
} from '@/features/marketplace';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { getLanguage, t } from '@/shared/lib/i18n';

export function AppMarketplaceDialog({
  error,
  installedPackages,
  installingSource,
  isPending,
  onInstall,
  onOpenChange,
  open,
}: {
  error: Error | null;
  installedPackages: AppPackageView[];
  installingSource?: string;
  isPending: boolean;
  onInstall: (source: string, registryUrl: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [search, setSearch] = useState('');
  const marketplace = useAppMarketplace(open);
  const installedAppIds = useMemo(
    () => new Set(installedPackages.map((entry) => entry.id)),
    [installedPackages],
  );
  const localeFallbacks = buildLocaleFallbacks(getLanguage() === 'zh' ? 'zh-CN' : 'en-US');
  const items = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const availableItems = marketplace.data?.items ?? [];
    if (!query) return availableItems;
    return availableItems.filter((item) => [
      item.name,
      item.appId,
      item.summary,
      pickLocalizedText(item.summaryI18n, item.summary, localeFallbacks),
      ...item.tags,
    ].some((value) => value.toLocaleLowerCase().includes(query)));
  }, [localeFallbacks, marketplace.data?.items, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[720px] sm:max-w-2xl">
        <MarketplaceHeader search={search} onSearchChange={setSearch} />
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-muted/15 px-3 py-3 sm:px-4">
          {error ? (
            <div role="alert" className="mb-3 rounded-xl bg-destructive/8 px-3 py-2.5 text-xs leading-5 text-destructive ring-1 ring-destructive/15">
              {error.message || t('appPackagesActionFailed')}
            </div>
          ) : null}
          <MarketplaceContent
            installedAppIds={installedAppIds}
            installedPackages={installedPackages}
            installingSource={installingSource}
            isError={marketplace.isError}
            isLoading={marketplace.isLoading}
            isPending={isPending}
            items={items}
            localeFallbacks={localeFallbacks}
            onInstall={onInstall}
          />
        </div>
        <div className="flex items-start gap-2 border-t border-border/70 bg-card px-5 py-3 text-[11px] leading-4 text-muted-foreground sm:px-6">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t('appPackagesMarketplaceTrustHint')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MarketplaceHeader({
  onSearchChange,
  search,
}: {
  onSearchChange: (value: string) => void;
  search: string;
}) {
  return (
    <div className="border-b border-border/70 px-5 pb-4 pt-5 sm:px-6">
      <DialogHeader className="pr-8">
        <DialogTitle>{t('appPackagesMarketplaceTitle')}</DialogTitle>
        <DialogDescription>{t('appPackagesMarketplaceDescription')}</DialogDescription>
      </DialogHeader>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          className="pl-9"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('appPackagesMarketplaceSearch')}
          aria-label={t('appPackagesMarketplaceSearch')}
        />
      </div>
    </div>
  );
}

function MarketplaceContent({
  installedAppIds,
  installedPackages,
  installingSource,
  isError,
  isLoading,
  isPending,
  items,
  localeFallbacks,
  onInstall,
}: {
  installedAppIds: Set<string>;
  installedPackages: AppPackageView[];
  installingSource?: string;
  isError: boolean;
  isLoading: boolean;
  isPending: boolean;
  items: ReturnType<typeof useAppMarketplace>['data'] extends infer Data
    ? Data extends { items: infer Items } ? Items : never
    : never;
  localeFallbacks: string[];
  onInstall: (source: string, registryUrl: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2.5" aria-label={t('appPackagesMarketplaceLoading')}>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
        {t('appPackagesMarketplaceFailed')}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <Search className="h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">{t('appPackagesMarketplaceEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <MarketplaceItemCard
          key={item.id}
          installed={installedAppIds.has(item.appId)}
          installedPackage={installedPackages.find((entry) => entry.id === item.appId)}
          isInstalling={isPending && installingSource === item.install.spec}
          isPending={isPending}
          item={item}
          localeFallbacks={localeFallbacks}
          onInstall={onInstall}
        />
      ))}
    </div>
  );
}

function MarketplaceItemCard({
  installed,
  installedPackage,
  isInstalling,
  isPending,
  item,
  localeFallbacks,
  onInstall,
}: {
  installed: boolean;
  installedPackage?: AppPackageView;
  isInstalling: boolean;
  isPending: boolean;
  item: NonNullable<ReturnType<typeof useAppMarketplace>['data']>['items'][number];
  localeFallbacks: string[];
  onInstall: (source: string, registryUrl: string) => void;
}) {
  const displayName = installedPackage
    ? readLocalizedText(installedPackage.name, installedPackage.nameI18n)
    : item.name;
  const summary = pickLocalizedText(item.summaryI18n, item.summary, localeFallbacks);
  return (
    <article className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <AppWindow className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-sm font-semibold text-foreground">{displayName}</h3>
            {item.featured ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t('appPackagesMarketplaceFeatured')}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/75">
              {item.publisher.name} · v{item.latestVersion}
            </span>
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
        <a
          href={item.webUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
        >
          {t('appPackagesMarketplaceDetails')}
          <ExternalLink className="ml-1.5 h-3 w-3" />
        </a>
        <Button
          type="button"
          size="sm"
          disabled={installed || isPending}
          onClick={() => onInstall(item.install.spec, item.install.registry)}
        >
          {installed ? (
            <><Check className="mr-1.5 h-3.5 w-3.5" />{t('appPackagesMarketplaceInstalled')}</>
          ) : isInstalling ? t('appPackagesInstalling') : t('appPackagesInstall')}
        </Button>
      </div>
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
