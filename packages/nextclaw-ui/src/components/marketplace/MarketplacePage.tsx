/* eslint-disable max-lines-per-function */
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
  MarketplacePluginContentView,
  MarketplaceSkillContentView,
  MarketplaceSort,
  MarketplaceItemType
} from '@/api/types';
import { fetchMarketplacePluginContent, fetchMarketplaceSkillContent } from '@/api/marketplace';
import { Tabs } from '@/components/ui/tabs-custom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDocBrowser } from '@/components/doc-browser';
import { useI18n } from '@/components/providers/I18nProvider';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  useInstallMarketplaceItem,
  useManageMarketplaceItem,
  useMarketplaceInstalled,
  useMarketplaceItems
} from '@/hooks/useMarketplace';
import {
  FilterPanel,
  MarketplaceListSkeleton,
  MarketplaceInfiniteScrollStatus
} from '@/components/marketplace/marketplace-page-parts';
import { buildLocaleFallbacks, pickLocalizedText } from '@/components/marketplace/marketplace-localization';
import { t } from '@/lib/i18n';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteScrollLoader } from '@/hooks/use-infinite-scroll-loader';

const PAGE_SIZE = 12;
const SKELETON_CARD_COUNT = PAGE_SIZE;

type ScopeType = 'all' | 'installed';

type InstallState = {
  installingSpecs: ReadonlySet<string>;
};

type ManageState = {
  actionsByTarget: ReadonlyMap<string, MarketplaceManageAction>;
};

type InstalledRenderEntry = {
  key: string;
  record: MarketplaceInstalledRecord;
  item?: MarketplaceItemSummary;
};

type MarketplaceRouteType = 'plugins' | 'skills';
type MarketplacePageProps = {
  forcedType?: MarketplaceRouteType;
};

function normalizeMarketplaceKey(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function toLookupKey(type: MarketplaceItemSummary['type'], value: string | undefined): string {
  const normalized = normalizeMarketplaceKey(value);
  return normalized.length > 0 ? `${type}:${normalized}` : '';
}

function buildCatalogLookup(items: MarketplaceItemSummary[]): Map<string, MarketplaceItemSummary> {
  const lookup = new Map<string, MarketplaceItemSummary>();

  for (const item of items) {
    const candidates = [item.install.spec, item.slug, item.id];
    for (const candidate of candidates) {
      const lookupKey = toLookupKey(item.type, candidate);
      if (!lookupKey || lookup.has(lookupKey)) {
        continue;
      }
      lookup.set(lookupKey, item);
    }
  }

  return lookup;
}

function buildInstalledRecordLookup(records: MarketplaceInstalledRecord[]): Map<string, MarketplaceInstalledRecord> {
  const lookup = new Map<string, MarketplaceInstalledRecord>();

  for (const record of records) {
    const candidates = [record.spec, record.id, record.label];
    for (const candidate of candidates) {
      const lookupKey = toLookupKey(record.type, candidate);
      if (!lookupKey || lookup.has(lookupKey)) {
        continue;
      }
      lookup.set(lookupKey, record);
    }
  }

  return lookup;
}

function findInstalledRecordForItem(
  item: MarketplaceItemSummary,
  installedRecordLookup: Map<string, MarketplaceInstalledRecord>
): MarketplaceInstalledRecord | undefined {
  const candidates = [item.install.spec, item.slug, item.id];
  for (const candidate of candidates) {
    const lookupKey = toLookupKey(item.type, candidate);
    if (!lookupKey) {
      continue;
    }
    const record = installedRecordLookup.get(lookupKey);
    if (record) {
      return record;
    }
  }
  return undefined;
}

function findCatalogItemForRecord(
  record: MarketplaceInstalledRecord,
  catalogLookup: Map<string, MarketplaceItemSummary>
): MarketplaceItemSummary | undefined {
  const bySpec = catalogLookup.get(toLookupKey(record.type, record.spec));
  if (bySpec) {
    return bySpec;
  }

  const byId = catalogLookup.get(toLookupKey(record.type, record.id));
  if (byId) {
    return byId;
  }

  return catalogLookup.get(toLookupKey(record.type, record.label));
}

function matchInstalledSearch(
  record: MarketplaceInstalledRecord,
  item: MarketplaceItemSummary | undefined,
  query: string,
  localeFallbacks: string[]
): boolean {
  const normalizedQuery = normalizeMarketplaceKey(query);
  if (!normalizedQuery) {
    return true;
  }

  const localizedSummary = pickLocalizedText(item?.summaryI18n, item?.summary, localeFallbacks);
  const values = [
    record.id,
    record.spec,
    record.label,
    item?.name,
    item?.slug,
    item?.summary,
    localizedSummary,
    ...(item?.tags ?? [])
  ];

  return values
    .map((value) => normalizeMarketplaceKey(value))
    .filter(Boolean)
    .some((value) => value.includes(normalizedQuery));
}

function getAvatarColor(text: string) {
  const colors = [
    'bg-amber-600', 'bg-orange-500', 'bg-yellow-600', 'bg-emerald-600',
    'bg-teal-600', 'bg-cyan-600', 'bg-stone-600', 'bg-rose-500', 'bg-violet-500'
  ];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function ItemIcon({ name, fallback }: { name?: string; fallback: string }) {
  const displayName = name || fallback;
  const letters = displayName.substring(0, 2).toUpperCase();
  const colorClass = getAvatarColor(displayName);
  return (
    <div className={cn('flex items-center justify-center w-10 h-10 rounded-xl text-white font-semibold text-sm shrink-0', colorClass)}>
      {letters}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildGenericDetailDataUrl(params: {
  title: string;
  typeLabel: string;
  spec: string;
  summary?: string;
  description?: string;
  metadataRaw?: string;
  contentRaw?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  tags?: string[];
  author?: string;
}): string {
  const metadata = params.metadataRaw?.trim() || '-';
  const content = params.contentRaw?.trim() || '-';
  const summary = params.summary?.trim();
  const description = params.description?.trim();
  const shouldShowDescription = Boolean(description) && description !== summary;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; background: #f7f9fc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px 40px; }
      .hero { border: 1px solid #dbeafe; border-radius: 16px; background: linear-gradient(180deg, #eff6ff, #ffffff); padding: 20px; box-shadow: 0 6px 20px rgba(30, 64, 175, 0.08); }
      .hero h1 { margin: 0; font-size: 26px; }
      .meta { margin-top: 8px; color: #475569; font-size: 13px; overflow-wrap: anywhere; word-break: break-word; }
      .summary { margin-top: 14px; font-size: 14px; line-height: 1.7; color: #334155; }
      .grid { display: grid; grid-template-columns: 260px 1fr; gap: 14px; margin-top: 16px; }
      .card { border: 1px solid #e2e8f0; background: #fff; border-radius: 14px; overflow: hidden; }
      .card h2 { margin: 0; padding: 12px 14px; font-size: 13px; font-weight: 700; color: #1d4ed8; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
      .card .body { padding: 12px 14px; font-size: 13px; color: #334155; line-height: 1.7; }
      .code { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.6; margin: 0; }
      .tags { margin-top: 10px; }
      .tag { display: inline-block; margin: 0 6px 6px 0; padding: 4px 9px; border-radius: 999px; background: #e0e7ff; color: #3730a3; font-size: 11px; }
      .source { color: #2563eb; text-decoration: none; overflow-wrap: anywhere; word-break: break-all; }
      @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <h1>${escapeHtml(params.title)}</h1>
        <div class="meta">${escapeHtml(params.typeLabel)} · ${escapeHtml(params.spec)}${params.author ? ` · ${escapeHtml(params.author)}` : ''}</div>
        ${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ''}
        ${shouldShowDescription ? `<p class="summary">${escapeHtml(description as string)}</p>` : ''}
        ${params.tags && params.tags.length > 0 ? `<div class="tags">${params.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        ${params.sourceUrl ? `<p class="meta" style="margin-top:12px;">${escapeHtml(params.sourceLabel ?? 'Source')}: <a class="source" href="${escapeHtml(params.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(params.sourceUrl)}</a></p>` : ''}
      </section>

      <section class="grid">
        <article class="card">
          <h2>Metadata</h2>
          <div class="body"><pre class="code">${escapeHtml(metadata)}</pre></div>
        </article>
        <article class="card">
          <h2>Content</h2>
          <div class="body"><pre class="code">${escapeHtml(content)}</pre></div>
        </article>
      </section>
    </main>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function MarketplaceListCard(props: {
  item?: MarketplaceItemSummary;
  record?: MarketplaceInstalledRecord;
  localeFallbacks: string[];
  installState: InstallState;
  manageState: ManageState;
  onOpen: () => void;
  onInstall: (item: MarketplaceItemSummary) => void;
  onManage: (action: MarketplaceManageAction, record: MarketplaceInstalledRecord) => void;
}) {
  const { item, record, localeFallbacks, installState, manageState, onOpen, onInstall, onManage } = props;
  const pluginRecord = record?.type === 'plugin' ? record : undefined;
  const title = item?.name ?? record?.label ?? record?.id ?? record?.spec ?? t('marketplaceUnknownItem');
  const summary = pickLocalizedText(item?.summaryI18n, item?.summary, localeFallbacks)
    || (record ? t('marketplaceInstalledLocalSummary') : '');
  const spec = item?.install.spec ?? record?.spec ?? '';

  const targetId = record?.id || record?.spec;
  const busyAction = targetId ? manageState.actionsByTarget.get(targetId) : undefined;
  const busyForRecord = Boolean(busyAction);

  const canToggle = Boolean(pluginRecord);
  const canUninstallPlugin = record?.type === 'plugin' && record.origin !== 'bundled';
  const canUninstallSkill = record?.type === 'skill' && record.source === 'workspace';
  const canUninstall = Boolean(canUninstallPlugin || canUninstallSkill);

  const isDisabled = record ? (record.enabled === false || record.runtimeStatus === 'disabled') : false;
  const installSpec = item?.install.spec;
  const isInstalling = typeof installSpec === 'string' && installState.installingSpecs.has(installSpec);

  return (
    <article
      onClick={onOpen}
      className="group bg-white border border-gray-200/40 hover:border-blue-300/80 rounded-2xl px-5 py-4 hover:shadow-md shadow-sm transition-all flex items-start gap-3.5 justify-between cursor-pointer"
    >
      <div className="flex gap-3 min-w-0 flex-1 h-full items-start">
        <ItemIcon name={title} fallback={spec || t('marketplaceTypeExtension')} />
        <div className="min-w-0 flex-1 flex flex-col justify-center h-full">
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-[14px] font-semibold text-gray-900 truncate leading-tight">{title}</div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px] text-xs">
                {title}
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1.5 mt-0.5 mb-1.5">
              {spec && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[11px] text-gray-400 truncate max-w-full font-mono">{spec}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[300px] text-xs font-mono break-all">
                    {spec}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[12px] text-gray-500/90 line-clamp-1 transition-colors leading-relaxed text-left">{summary}</p>
              </TooltipTrigger>
              {summary && (
                <TooltipContent className="max-w-[400px] text-xs leading-relaxed">
                  {summary}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="shrink-0 flex items-center h-full">
        {item && !record && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onInstall(item);
            }}
            disabled={isInstalling}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-medium bg-primary text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {isInstalling ? t('marketplaceInstalling') : t('marketplaceInstall')}
          </button>
        )}

        {pluginRecord && canToggle && (
          <button
            disabled={busyForRecord}
            onClick={(event) => {
              event.stopPropagation();
              onManage(isDisabled ? 'enable' : 'disable', pluginRecord);
            }}
            className="inline-flex items-center h-8 px-4 rounded-xl text-xs font-medium border border-gray-200/80 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            {busyAction && busyAction !== 'uninstall'
              ? (busyAction === 'enable' ? t('marketplaceEnabling') : t('marketplaceDisabling'))
              : (isDisabled ? t('marketplaceEnable') : t('marketplaceDisable'))}
          </button>
        )}

        {record && canUninstall && (
          <button
            disabled={busyForRecord}
            onClick={(event) => {
              event.stopPropagation();
              onManage('uninstall', record);
            }}
            className="inline-flex items-center h-8 px-4 rounded-xl text-xs font-medium border border-rose-100 text-rose-500 bg-white hover:bg-rose-50 hover:border-rose-200 disabled:opacity-50 transition-colors"
          >
            {busyAction === 'uninstall' ? t('marketplaceRemoving') : t('marketplaceUninstall')}
          </button>
        )}
      </div>
    </article>
  );
}

export function MarketplacePage(props: MarketplacePageProps = {}) {
  const { forcedType } = props;
  const navigate = useNavigate();
  const params = useParams<{ type?: string }>();
  const { language } = useI18n();
  const docBrowser = useDocBrowser();

  const routeType: MarketplaceRouteType | null = useMemo(() => {
    if (forcedType === 'plugins' || forcedType === 'skills') {
      return forcedType;
    }
    if (params.type === 'plugins' || params.type === 'skills') {
      return params.type;
    }
    return null;
  }, [forcedType, params.type]);

  useEffect(() => {
    if (forcedType) {
      return;
    }
    if (!routeType) {
      navigate('/marketplace/plugins', { replace: true });
    }
  }, [forcedType, routeType, navigate]);

  const typeFilter: MarketplaceItemType = routeType === 'skills' ? 'skill' : 'plugin';
  const localeFallbacks = useMemo(() => buildLocaleFallbacks(language), [language]);

  const isPluginModule = typeFilter === 'plugin';
  const copyKeys = isPluginModule
    ? {
      pageTitle: 'marketplacePluginsPageTitle',
      pageDescription: 'marketplacePluginsPageDescription',
      tabMarketplace: 'marketplaceTabMarketplacePlugins',
      tabInstalled: 'marketplaceTabInstalledPlugins',
      searchPlaceholder: 'marketplaceSearchPlaceholderPlugins',
      sectionCatalog: 'marketplaceSectionPlugins',
      sectionInstalled: 'marketplaceSectionInstalledPlugins',
      errorLoadData: 'marketplaceErrorLoadingPluginsData',
      errorLoadInstalled: 'marketplaceErrorLoadingInstalledPlugins',
      emptyData: 'marketplaceNoPlugins',
      emptyInstalled: 'marketplaceNoInstalledPlugins',
      installedCountSuffix: 'marketplaceInstalledPluginsCountSuffix'
    }
    : {
      pageTitle: 'marketplaceSkillsPageTitle',
      pageDescription: 'marketplaceSkillsPageDescription',
      tabMarketplace: 'marketplaceTabMarketplaceSkills',
      tabInstalled: 'marketplaceTabInstalledSkills',
      searchPlaceholder: 'marketplaceSearchPlaceholderSkills',
      sectionCatalog: 'marketplaceSectionSkills',
      sectionInstalled: 'marketplaceSectionInstalledSkills',
      errorLoadData: 'marketplaceErrorLoadingSkillsData',
      errorLoadInstalled: 'marketplaceErrorLoadingInstalledSkills',
      emptyData: 'marketplaceNoSkills',
      emptyInstalled: 'marketplaceNoInstalledSkills',
      installedCountSuffix: 'marketplaceInstalledSkillsCountSuffix'
    };

  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeType>('all');
  const [sort, setSort] = useState<MarketplaceSort>('relevance');
  const [installingSpecs, setInstallingSpecs] = useState<ReadonlySet<string>>(new Set());
  const [managingTargets, setManagingTargets] = useState<ReadonlyMap<string, MarketplaceManageAction>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchText.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const installedQuery = useMarketplaceInstalled(typeFilter);

  const itemsQuery = useMarketplaceItems({
    q: query || undefined,
    type: typeFilter,
    sort,
    pageSize: PAGE_SIZE
  });

  const infiniteScroll = useInfiniteScrollLoader({
    disabled: scope !== 'all' || itemsQuery.isError || !itemsQuery.hasNextPage || itemsQuery.isFetchingNextPage,
    onLoadMore: () => itemsQuery.fetchNextPage(),
    watchValue: `${typeFilter}:${scope}:${query}:${sort}:${itemsQuery.data?.loadedItems ?? 0}:${itemsQuery.data?.loadedPages ?? 0}`
  });

  useEffect(() => {
    infiniteScroll.containerRef.current?.scrollTo({ top: 0 });
  }, [infiniteScroll.containerRef, query, scope, sort, typeFilter]);

  const installMutation = useInstallMarketplaceItem();
  const manageMutation = useManageMarketplaceItem();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const installedRecords = useMemo(
    () => installedQuery.data?.records ?? [],
    [installedQuery.data?.records]
  );

  const allItems = useMemo(
    () => itemsQuery.data?.items ?? [],
    [itemsQuery.data?.items]
  );

  const catalogLookup = useMemo(
    () => buildCatalogLookup(allItems),
    [allItems]
  );

  const installedRecordLookup = useMemo(
    () => buildInstalledRecordLookup(installedRecords),
    [installedRecords]
  );

  const installedEntries = useMemo<InstalledRenderEntry[]>(() => {
    const entries = installedRecords
      .filter((record) => record.type === typeFilter)
      .map((record) => ({
        key: `${record.type}:${record.spec}:${record.id ?? ''}`,
        record,
        item: findCatalogItemForRecord(record, catalogLookup)
      }))
      .filter((entry) => matchInstalledSearch(entry.record, entry.item, query, localeFallbacks));

    entries.sort((left, right) => {
      const leftTs = left.record.installedAt ? Date.parse(left.record.installedAt) : Number.NaN;
      const rightTs = right.record.installedAt ? Date.parse(right.record.installedAt) : Number.NaN;
      const leftValid = !Number.isNaN(leftTs);
      const rightValid = !Number.isNaN(rightTs);

      if (leftValid && rightValid && leftTs !== rightTs) {
        return rightTs - leftTs;
      }

      return left.record.spec.localeCompare(right.record.spec);
    });

    return entries;
  }, [installedRecords, typeFilter, catalogLookup, query, localeFallbacks]);

  const total = scope === 'installed' ? installedEntries.length : (itemsQuery.data?.total ?? 0);
  const showCatalogSkeleton = scope === 'all' && itemsQuery.isLoading && !itemsQuery.data;
  const showInstalledSkeleton = scope === 'installed' && installedQuery.isLoading && !installedQuery.data;
  const showListSkeleton = showCatalogSkeleton || showInstalledSkeleton;

  const listSummary = useMemo(() => {
    if (scope === 'installed') {
      if (installedQuery.isLoading && !installedQuery.data) {
        return t('loading');
      }
      return `${installedEntries.length} ${t(copyKeys.installedCountSuffix)}`;
    }

    if (!itemsQuery.data) {
      return t('loading');
    }

    return `${allItems.length} / ${total}`;
  }, [scope, installedQuery.data, installedQuery.isLoading, installedEntries.length, itemsQuery.data, allItems.length, total, copyKeys.installedCountSuffix]);

  const installState: InstallState = { installingSpecs };

  const manageState: ManageState = {
    actionsByTarget: managingTargets
  };

  const scopeTabs = [
    { id: 'all', label: t(copyKeys.tabMarketplace) },
    { id: 'installed', label: t(copyKeys.tabInstalled), count: installedQuery.data?.total ?? 0 }
  ];

  const handleInstall = async (item: MarketplaceItemSummary) => {
    const installSpec = item.install.spec;
    if (installingSpecs.has(installSpec)) {
      return;
    }

    setInstallingSpecs((prev) => {
      const next = new Set(prev);
      next.add(installSpec);
      return next;
    });

    try {
      await installMutation.mutateAsync({
        type: item.type,
        spec: installSpec,
        kind: item.install.kind,
        ...(item.type === 'skill'
          ? {
              skill: item.slug,
              installPath: `skills/${item.slug}`
            }
          : {})
      });
    } catch {
      // handled in mutation onError
    } finally {
      setInstallingSpecs((prev) => {
        if (!prev.has(installSpec)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(installSpec);
        return next;
      });
    }
  };

  const handleManage = async (action: MarketplaceManageAction, record: MarketplaceInstalledRecord) => {
    const targetId = record.id || record.spec;
    if (!targetId) {
      return;
    }
    if (managingTargets.has(targetId)) {
      return;
    }

    if (action === 'uninstall') {
      const confirmed = await confirm({
        title: `${t('marketplaceUninstallTitle')} ${targetId}?`,
        description: t('marketplaceUninstallDescription'),
        confirmLabel: t('marketplaceUninstall'),
        variant: 'destructive'
      });
      if (!confirmed) {
        return;
      }
    }

    setManagingTargets((previous) => {
      const next = new Map(previous);
      next.set(targetId, action);
      return next;
    });

    try {
      await manageMutation.mutateAsync({
        type: record.type,
        action,
        id: targetId,
        spec: record.spec
      });
    } finally {
      setManagingTargets((previous) => {
        if (!previous.has(targetId)) {
          return previous;
        }
        const next = new Map(previous);
        next.delete(targetId);
        return next;
      });
    }
  };

  const openItemDetail = async (item?: MarketplaceItemSummary, record?: MarketplaceInstalledRecord) => {
    const title = item?.name ?? record?.label ?? record?.id ?? record?.spec ?? t('marketplaceUnknownItem');

    if (!item) {
      const url = buildGenericDetailDataUrl({
        title,
        typeLabel: record?.type === 'plugin' ? t('marketplaceTypePlugin') : t('marketplaceTypeSkill'),
        spec: record?.spec ?? '-',
        summary: t('marketplaceInstalledLocalSummary'),
        metadataRaw: JSON.stringify(record ?? {}, null, 2),
        contentRaw: '-'
      });
      docBrowser.open(url, { newTab: true, title, kind: 'content' });
      return;
    }

    const summary = pickLocalizedText(item.summaryI18n, item.summary, localeFallbacks);

    if (item.type === 'skill') {
      try {
        const content: MarketplaceSkillContentView = await fetchMarketplaceSkillContent(item.slug);
        const url = buildGenericDetailDataUrl({
          title,
          typeLabel: t('marketplaceTypeSkill'),
          spec: item.install.spec,
          summary,
          metadataRaw: content.metadataRaw,
          contentRaw: content.bodyRaw || content.raw,
          sourceUrl: content.sourceUrl,
          sourceLabel: `Source (${content.source})`,
          tags: item.tags,
          author: item.author
        });
        docBrowser.open(url, { newTab: true, title, kind: 'content' });
      } catch (error) {
        const url = buildGenericDetailDataUrl({
          title,
          typeLabel: t('marketplaceTypeSkill'),
          spec: item.install.spec,
          summary,
          metadataRaw: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2),
          contentRaw: t('marketplaceOperationFailed')
        });
        docBrowser.open(url, { newTab: true, title, kind: 'content' });
      }
      return;
    }

    try {
      const content: MarketplacePluginContentView = await fetchMarketplacePluginContent(item.slug);
      const url = buildGenericDetailDataUrl({
        title,
        typeLabel: t('marketplaceTypePlugin'),
        spec: item.install.spec,
        summary,
        metadataRaw: content.metadataRaw,
        contentRaw: content.bodyRaw || content.raw || item.summary,
        sourceUrl: content.sourceUrl,
        sourceLabel: `Source (${content.source})`,
        tags: item.tags,
        author: item.author
      });
      docBrowser.open(url, { newTab: true, title, kind: 'content' });
    } catch (error) {
      const url = buildGenericDetailDataUrl({
        title,
        typeLabel: t('marketplaceTypePlugin'),
        spec: item.install.spec,
        summary,
        metadataRaw: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2),
        contentRaw: '-'
      });
      docBrowser.open(url, { newTab: true, title, kind: 'content' });
    }
  };

  return (
    <PageLayout className="flex h-full min-h-0 flex-col pb-0">
      <PageHeader title={t(copyKeys.pageTitle)} description={t(copyKeys.pageDescription)} />

      <Tabs
        tabs={scopeTabs}
        activeTab={scope}
        onChange={(value) => {
          setScope(value as ScopeType);
        }}
        className="mb-4"
      />

      <FilterPanel
        scope={scope}
        searchText={searchText}
        searchPlaceholder={t(copyKeys.searchPlaceholder)}
        sort={sort}
        onSearchTextChange={setSearchText}
        onSortChange={(value) => {
          setSort(value);
        }}
      />

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-gray-900">
            {scope === 'installed' ? t(copyKeys.sectionInstalled) : t(copyKeys.sectionCatalog)}
          </h3>
          <span className="text-[12px] text-gray-500">{listSummary}</span>
        </div>

        {scope === 'all' && itemsQuery.isError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {t(copyKeys.errorLoadData)}: {itemsQuery.error.message}
          </div>
        )}
        {scope === 'installed' && installedQuery.isError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {t(copyKeys.errorLoadInstalled)}: {installedQuery.error.message}
          </div>
        )}

        <div
          ref={infiniteScroll.containerRef}
          className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1"
          aria-busy={showListSkeleton || itemsQuery.isFetchingNextPage}
        >
          <div
            data-testid={showListSkeleton ? 'marketplace-list-skeleton' : undefined}
            className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3"
          >
            {showListSkeleton && <MarketplaceListSkeleton count={SKELETON_CARD_COUNT} />}

            {!showListSkeleton && scope === 'all' && allItems.map((item) => (
              <MarketplaceListCard
                key={item.id}
                item={item}
                record={findInstalledRecordForItem(item, installedRecordLookup)}
                localeFallbacks={localeFallbacks}
                installState={installState}
                manageState={manageState}
                onOpen={() => void openItemDetail(item, findInstalledRecordForItem(item, installedRecordLookup))}
                onInstall={handleInstall}
                onManage={handleManage}
              />
            ))}

            {!showListSkeleton && scope === 'installed' && installedEntries.map((entry) => (
              <MarketplaceListCard
                key={entry.key}
                item={entry.item}
                record={entry.record}
                localeFallbacks={localeFallbacks}
                installState={installState}
                manageState={manageState}
                onOpen={() => void openItemDetail(entry.item, entry.record)}
                onInstall={handleInstall}
                onManage={handleManage}
              />
            ))}
          </div>

          {scope === 'all' && !showListSkeleton && !itemsQuery.isError && allItems.length === 0 && (
            <div className="text-[13px] text-gray-500 py-8 text-center">{t(copyKeys.emptyData)}</div>
          )}
          {scope === 'installed' && !showListSkeleton && !installedQuery.isError && installedEntries.length === 0 && (
            <div className="text-[13px] text-gray-500 py-8 text-center">{t(copyKeys.emptyInstalled)}</div>
          )}

          {scope === 'all' && !showCatalogSkeleton && !itemsQuery.isError && (
            <MarketplaceInfiniteScrollStatus
              hasMore={Boolean(itemsQuery.hasNextPage)}
              loading={itemsQuery.isFetchingNextPage}
              sentinelRef={infiniteScroll.sentinelRef}
            />
          )}
        </div>
      </section>
      <ConfirmDialog />
    </PageLayout>
  );
}
