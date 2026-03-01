/* eslint-disable max-lines-per-function */
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceLocalizedTextMap,
  MarketplaceManageAction,
  MarketplacePluginContentView,
  MarketplaceSkillContentView,
  MarketplaceSort,
  MarketplaceItemType
} from '@/api/types';
import { fetchMarketplacePluginContent, fetchMarketplaceSkillContent } from '@/api/marketplace';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { t } from '@/lib/i18n';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
import { cn } from '@/lib/utils';
import { PackageSearch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const PAGE_SIZE = 12;

type ScopeType = 'all' | 'installed';

type InstallState = {
  installingSpecs: ReadonlySet<string>;
};

type ManageState = {
  isPending: boolean;
  targetId?: string;
  action?: MarketplaceManageAction;
};

type InstalledRenderEntry = {
  key: string;
  record: MarketplaceInstalledRecord;
  item?: MarketplaceItemSummary;
};

type MarketplaceRouteType = 'plugins' | 'skills';

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

function buildLocaleFallbacks(language: string): string[] {
  const normalized = language.trim().toLowerCase().replace(/_/g, '-');
  const base = normalized.split('-')[0];
  const fallbacks = [normalized, base, 'en'];
  return Array.from(new Set(fallbacks.filter(Boolean)));
}

function normalizeLocaleTag(locale: string): string {
  return locale.trim().toLowerCase().replace(/_/g, '-');
}

function pickLocalizedText(
  localized: MarketplaceLocalizedTextMap | undefined,
  fallback: string | undefined,
  localeFallbacks: string[]
): string {
  if (localized) {
    const entries = Object.entries(localized)
      .map(([locale, text]) => ({ locale: normalizeLocaleTag(locale), text: typeof text === 'string' ? text.trim() : '' }))
      .filter((entry) => entry.text.length > 0);

    if (entries.length > 0) {
      const exactMap = new Map(entries.map((entry) => [entry.locale, entry.text] as const));

      for (const locale of localeFallbacks) {
        const normalizedLocale = normalizeLocaleTag(locale);
        const exact = exactMap.get(normalizedLocale);
        if (exact) {
          return exact;
        }
      }

      for (const locale of localeFallbacks) {
        const base = normalizeLocaleTag(locale).split('-')[0];
        if (!base) {
          continue;
        }
        const matched = entries.find((entry) => entry.locale === base || entry.locale.startsWith(`${base}-`));
        if (matched) {
          return matched.text;
        }
      }

      return entries[0]?.text ?? '';
    }
  }

  return fallback?.trim() ?? '';
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

function FilterPanel(props: {
  scope: ScopeType;
  searchText: string;
  searchPlaceholder: string;
  sort: MarketplaceSort;
  onSearchTextChange: (value: string) => void;
  onSortChange: (value: MarketplaceSort) => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex gap-3 items-center">
        <div className="flex-1 min-w-0 relative">
          <PackageSearch className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={props.searchText}
            onChange={(event) => props.onSearchTextChange(event.target.value)}
            placeholder={props.searchPlaceholder}
            className="w-full h-9 border border-gray-200/80 rounded-xl pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {props.scope === 'all' && (
          <Select value={props.sort} onValueChange={(v) => props.onSortChange(v as MarketplaceSort)}>
            <SelectTrigger className="h-9 w-[150px] shrink-0 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">{t('marketplaceSortRelevance')}</SelectItem>
              <SelectItem value="updated">{t('marketplaceSortUpdated')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
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
  const record = props.record;
  const pluginRecord = record?.type === 'plugin' ? record : undefined;
  const type = props.item?.type ?? record?.type;
  const title = props.item?.name ?? record?.label ?? record?.id ?? record?.spec ?? t('marketplaceUnknownItem');
  const summary = pickLocalizedText(props.item?.summaryI18n, props.item?.summary, props.localeFallbacks)
    || (record ? t('marketplaceInstalledLocalSummary') : '');
  const spec = props.item?.install.spec ?? record?.spec ?? '';

  const targetId = record?.id || record?.spec;
  const busyForRecord = Boolean(targetId) && props.manageState.isPending && props.manageState.targetId === targetId;

  const canToggle = Boolean(pluginRecord);
  const canUninstallPlugin = record?.type === 'plugin' && record.origin !== 'bundled';
  const canUninstallSkill = record?.type === 'skill' && record.source === 'workspace';
  const canUninstall = Boolean(canUninstallPlugin || canUninstallSkill);

  const isDisabled = record ? (record.enabled === false || record.runtimeStatus === 'disabled') : false;
  const installSpec = props.item?.install.spec;
  const isInstalling = typeof installSpec === 'string' && props.installState.installingSpecs.has(installSpec);

  const displayType = type === 'plugin' ? t('marketplaceTypePlugin') : type === 'skill' ? t('marketplaceTypeSkill') : t('marketplaceTypeExtension');

  return (
    <article
      onClick={props.onOpen}
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
              <span className="text-[11px] text-gray-500 font-medium">{displayType}</span>
              {spec && (
                <>
                  <span className="text-[10px] text-gray-300">•</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[11px] text-gray-400 truncate max-w-full font-mono">{spec}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[300px] text-xs font-mono break-all">
                      {spec}
                    </TooltipContent>
                  </Tooltip>
                </>
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
        {props.item && !record && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              props.onInstall(props.item as MarketplaceItemSummary);
            }}
            disabled={isInstalling}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-medium bg-primary text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {isInstalling ? t('marketplaceInstalling') : t('marketplaceInstall')}
          </button>
        )}

        {pluginRecord && canToggle && (
          <button
            disabled={props.manageState.isPending}
            onClick={(event) => {
              event.stopPropagation();
              props.onManage(isDisabled ? 'enable' : 'disable', pluginRecord);
            }}
            className="inline-flex items-center h-8 px-4 rounded-xl text-xs font-medium border border-gray-200/80 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            {busyForRecord && props.manageState.action !== 'uninstall'
              ? (props.manageState.action === 'enable' ? t('marketplaceEnabling') : t('marketplaceDisabling'))
              : (isDisabled ? t('marketplaceEnable') : t('marketplaceDisable'))}
          </button>
        )}

        {record && canUninstall && (
          <button
            disabled={props.manageState.isPending}
            onClick={(event) => {
              event.stopPropagation();
              props.onManage('uninstall', record);
            }}
            className="inline-flex items-center h-8 px-4 rounded-xl text-xs font-medium border border-rose-100 text-rose-500 bg-white hover:bg-rose-50 hover:border-rose-200 disabled:opacity-50 transition-colors"
          >
            {busyForRecord && props.manageState.action === 'uninstall' ? t('marketplaceRemoving') : t('marketplaceUninstall')}
          </button>
        )}
      </div>
    </article>
  );
}

function PaginationBar(props: {
  page: number;
  totalPages: number;
  busy: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <button
        className="h-8 px-3 rounded-xl border border-gray-200/80 text-sm text-gray-600 disabled:opacity-40"
        onClick={props.onPrev}
        disabled={props.page <= 1 || props.busy}
      >
        {t('prev')}
      </button>
      <div className="text-sm text-gray-600 min-w-20 text-center">
        {props.totalPages === 0 ? '0 / 0' : `${props.page} / ${props.totalPages}`}
      </div>
      <button
        className="h-8 px-3 rounded-xl border border-gray-200/80 text-sm text-gray-600 disabled:opacity-40"
        onClick={props.onNext}
        disabled={props.totalPages === 0 || props.page >= props.totalPages || props.busy}
      >
        {t('next')}
      </button>
    </div>
  );
}

export function MarketplacePage() {
  const navigate = useNavigate();
  const params = useParams<{ type?: string }>();
  const { language } = useI18n();
  const docBrowser = useDocBrowser();

  const routeType: MarketplaceRouteType | null = useMemo(() => {
    if (params.type === 'plugins' || params.type === 'skills') {
      return params.type;
    }
    return null;
  }, [params.type]);

  useEffect(() => {
    if (!routeType) {
      navigate('/marketplace/plugins', { replace: true });
    }
  }, [routeType, navigate]);

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
  const [page, setPage] = useState(1);
  const [installingSpecs, setInstallingSpecs] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setQuery(searchText.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  const installedQuery = useMarketplaceInstalled(typeFilter);

  const itemsQuery = useMarketplaceItems({
    q: query || undefined,
    type: typeFilter,
    sort,
    page,
    pageSize: PAGE_SIZE
  });

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
  const totalPages = scope === 'installed' ? 1 : (itemsQuery.data?.totalPages ?? 0);

  const listSummary = useMemo(() => {
    if (scope === 'installed') {
      if (installedQuery.isLoading) {
        return t('loading');
      }
      return `${installedEntries.length} ${t(copyKeys.installedCountSuffix)}`;
    }

    if (!itemsQuery.data) {
      return t('loading');
    }

    return `${allItems.length} / ${total}`;
  }, [scope, installedQuery.isLoading, installedEntries.length, itemsQuery.data, allItems.length, total, copyKeys.installedCountSuffix]);

  const installState: InstallState = { installingSpecs };

  const manageState: ManageState = {
    isPending: manageMutation.isPending,
    targetId: manageMutation.variables?.id || manageMutation.variables?.spec,
    action: manageMutation.variables?.action
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
    if (manageMutation.isPending) {
      return;
    }

    const targetId = record.id || record.spec;
    if (!targetId) {
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

    manageMutation.mutate({
      type: record.type,
      action,
      id: targetId,
      spec: record.spec
    });
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
    <PageLayout>
      <PageHeader title={t(copyKeys.pageTitle)} description={t(copyKeys.pageDescription)} />

      <Tabs
        tabs={scopeTabs}
        activeTab={scope}
        onChange={(value) => {
          setScope(value as ScopeType);
          setPage(1);
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
          setPage(1);
          setSort(value);
        }}
      />

      <section>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {scope === 'all' && allItems.map((item) => (
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

          {scope === 'installed' && installedEntries.map((entry) => (
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

        {scope === 'all' && !itemsQuery.isLoading && !itemsQuery.isError && allItems.length === 0 && (
          <div className="text-[13px] text-gray-500 py-8 text-center">{t(copyKeys.emptyData)}</div>
        )}
        {scope === 'installed' && !installedQuery.isLoading && !installedQuery.isError && installedEntries.length === 0 && (
          <div className="text-[13px] text-gray-500 py-8 text-center">{t(copyKeys.emptyInstalled)}</div>
        )}
      </section>

      {scope === 'all' && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          busy={itemsQuery.isFetching}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => (totalPages > 0 ? Math.min(totalPages, current + 1) : current + 1))}
        />
      )}
      <ConfirmDialog />
    </PageLayout>
  );
}
