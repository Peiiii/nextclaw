import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchOwnerMarketplaceAppDetail,
  fetchOwnerMarketplaceApps,
  manageOwnerMarketplaceApp,
} from '@/api/marketplace-owner-client';
import type {
  OwnerMarketplaceAppDetailView,
  OwnerMarketplaceAppManageAction,
  OwnerMarketplaceAppSummaryView,
} from '@/api/types';
import {
  ConsoleMetricCard,
  ConsoleMetricGrid,
  ConsolePage,
  ConsoleSection,
  ConsoleSurface,
} from '@/components/console/console-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateTime, type LocaleCode } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type Props = {
  token: string;
  t: Translate;
};

export function UserAppsPage({ token, t }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['owner-marketplace-apps', searchQuery],
    queryFn: async () => await fetchOwnerMarketplaceApps(token, { q: searchQuery }),
  });

  const items = listQuery.data?.items ?? [];
  const resolvedSelector = resolveSelectedSelector(selectedSelector, items);
  const detailQuery = useQuery({
    queryKey: ['owner-marketplace-app-detail', resolvedSelector],
    enabled: Boolean(resolvedSelector),
    queryFn: async () => await fetchOwnerMarketplaceAppDetail(token, resolvedSelector ?? ''),
  });

  const manageMutation = useMutation({
    mutationFn: async (params: { selector: string; action: OwnerMarketplaceAppManageAction }) =>
      await manageOwnerMarketplaceApp(token, params.selector, params.action),
    onSuccess: async (data, variables) => {
      if (variables.action === 'delete') {
        setSelectedSelector((current) => (current === variables.selector ? null : current));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['owner-marketplace-apps'] }),
        queryClient.invalidateQueries({ queryKey: ['owner-marketplace-app-detail', variables.selector] }),
      ]);
      queryClient.setQueryData<OwnerMarketplaceAppDetailView | undefined>(
        ['owner-marketplace-app-detail', variables.selector],
        data.item,
      );
    },
  });

  const metrics = useMemo(() => {
    const total = items.length;
    const liveCount = items.filter((item) => item.publishStatus === 'published' && item.ownerVisibility === 'public').length;
    const hiddenCount = items.filter((item) => item.ownerVisibility === 'hidden').length;
    const pendingCount = items.filter((item) => item.publishStatus === 'pending').length;
    return { total, liveCount, hiddenCount, pendingCount };
  }, [items]);

  const pendingAction =
    manageMutation.variables?.selector === detailQuery.data?.appId
      ? manageMutation.variables?.action ?? null
      : null;

  return (
    <ConsolePage>
      <AppsMetrics metrics={metrics} t={t} />
      <AppsManagementSection
        items={items}
        locale={locale}
        resolvedSelector={resolvedSelector}
        searchInput={searchInput}
        t={t}
        detailError={detailQuery.error}
        detailItem={detailQuery.data}
        detailLoading={detailQuery.isLoading}
        listError={listQuery.error}
        listLoading={listQuery.isLoading}
        manageError={manageMutation.error}
        pending={manageMutation.isPending}
        pendingAction={pendingAction}
        onManage={(action) => {
          if (!detailQuery.data) {
            return;
          }
          if (action === 'delete' && !window.confirm(t('apps.messages.deleteConfirm'))) {
            return;
          }
          manageMutation.mutate({
            selector: detailQuery.data.appId,
            action,
          });
        }}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={() => {
          setSearchQuery(searchInput.trim());
          setSelectedSelector(null);
        }}
        onSearchClear={() => {
          setSearchInput('');
          setSearchQuery('');
          setSelectedSelector(null);
        }}
        onSelect={setSelectedSelector}
      />
    </ConsolePage>
  );
}

function AppsMetrics(props: {
  metrics: { total: number; liveCount: number; hiddenCount: number; pendingCount: number };
  t: Translate;
}): JSX.Element {
  const { metrics, t } = props;
  return (
    <ConsoleMetricGrid>
      <ConsoleMetricCard label={t('apps.metrics.total')} value={String(metrics.total)} hint={t('apps.metrics.totalHint')} />
      <ConsoleMetricCard label={t('apps.metrics.live')} value={String(metrics.liveCount)} hint={t('apps.metrics.liveHint')} />
      <ConsoleMetricCard label={t('apps.metrics.hidden')} value={String(metrics.hiddenCount)} hint={t('apps.metrics.hiddenHint')} />
      <ConsoleMetricCard label={t('apps.metrics.pending')} value={String(metrics.pendingCount)} hint={t('apps.metrics.pendingHint')} />
    </ConsoleMetricGrid>
  );
}

function AppsManagementSection(props: {
  items: OwnerMarketplaceAppSummaryView[];
  locale: LocaleCode;
  resolvedSelector: string | null;
  searchInput: string;
  t: Translate;
  detailError: unknown;
  detailItem?: OwnerMarketplaceAppDetailView;
  detailLoading: boolean;
  listError: unknown;
  listLoading: boolean;
  manageError: unknown;
  pending: boolean;
  pendingAction: OwnerMarketplaceAppManageAction | null;
  onManage: (action: OwnerMarketplaceAppManageAction) => void;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  onSelect: (selector: string) => void;
}): JSX.Element {
  const {
    items,
    locale,
    resolvedSelector,
    searchInput,
    t,
    detailError,
    detailItem,
    detailLoading,
    listError,
    listLoading,
    manageError,
    pending,
    pendingAction,
    onManage,
    onSearchInputChange,
    onSearchSubmit,
    onSearchClear,
    onSelect,
  } = props;
  return (
    <ConsoleSection
      title={t('apps.title')}
      description={t('apps.description')}
      actions={(
        <AppsSearchActions
          searchInput={searchInput}
          t={t}
          onChange={onSearchInputChange}
          onClear={onSearchClear}
          onSearch={onSearchSubmit}
        />
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <AppsListPanel
          items={items}
          locale={locale}
          resolvedSelector={resolvedSelector}
          t={t}
          error={listError}
          loading={listLoading}
          onSelect={onSelect}
        />
        <AppDetailSurface
          locale={locale}
          t={t}
          detailError={detailError}
          detailItem={detailItem}
          detailLoading={detailLoading}
          manageError={manageError}
          pending={pending}
          pendingAction={pendingAction}
          resolvedSelector={resolvedSelector}
          onManage={onManage}
        />
      </div>
    </ConsoleSection>
  );
}

function AppsSearchActions(props: {
  searchInput: string;
  t: Translate;
  onChange: (value: string) => void;
  onClear: () => void;
  onSearch: () => void;
}): JSX.Element {
  const { searchInput, t, onChange, onClear, onSearch } = props;
  return (
    <>
      <Input
        value={searchInput}
        placeholder={t('apps.searchPlaceholder')}
        className="w-[240px]"
        onChange={(event) => onChange(event.target.value)}
      />
      <Button type="button" variant="secondary" onClick={onSearch}>{t('apps.actions.search')}</Button>
      <Button type="button" variant="ghost" onClick={onClear}>{t('apps.actions.clear')}</Button>
    </>
  );
}

function AppsListPanel(props: {
  items: OwnerMarketplaceAppSummaryView[];
  locale: LocaleCode;
  resolvedSelector: string | null;
  t: Translate;
  error: unknown;
  loading: boolean;
  onSelect: (selector: string) => void;
}): JSX.Element {
  const { items, locale, resolvedSelector, t, error, loading, onSelect } = props;
  return (
    <ConsoleSurface className="overflow-hidden">
      <div className="border-b border-[#e4e0d7] px-4 py-3">
        <p className="text-sm font-semibold text-[#1f1f1d]">{t('apps.queueTitle')}</p>
        <p className="mt-1 text-xs text-[#8f8a7d]">{t('apps.queueSummary', { count: items.length })}</p>
      </div>
      <div className="space-y-2 p-3">
        {loading ? <p className="px-1 py-6 text-sm text-[#8f8a7d]">{t('apps.messages.loading')}</p> : null}
        {error instanceof Error ? <p className="px-1 text-sm text-rose-600">{error.message}</p> : null}
        {!loading && items.length === 0 ? <p className="px-1 py-6 text-sm text-[#8f8a7d]">{t('apps.messages.empty')}</p> : null}
        {items.map((item) => (
          <AppListItem
            key={item.id}
            item={item}
            locale={locale}
            selected={resolvedSelector === item.appId}
            t={t}
            onSelect={onSelect}
          />
        ))}
      </div>
    </ConsoleSurface>
  );
}

function AppListItem(props: {
  item: OwnerMarketplaceAppSummaryView;
  locale: LocaleCode;
  selected: boolean;
  t: Translate;
  onSelect: (selector: string) => void;
}): JSX.Element {
  const { item, locale, selected, t, onSelect } = props;
  return (
    <button
      type="button"
      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
        selected
          ? 'border-brand-300 bg-brand-50'
          : 'border-[#e4e0d7] bg-[#f9f8f5] hover:border-[#d4cdbd] hover:bg-[#f3f2ee]'
      }`}
      onClick={() => onSelect(item.appId)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#1f1f1d]">{item.name}</p>
          <p className="mt-1 truncate text-xs text-[#8f8a7d]">{item.appId}</p>
        </div>
        <AppStateBadges item={item} t={t} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[#656561]">{item.summary}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8f8a7d]">
        <span>{item.ownerScope}</span>
        <span>v{item.latestVersion}</span>
        <span>{formatDateTime(locale, item.updatedAt)}</span>
      </div>
    </button>
  );
}

function AppStateBadges(props: { item: OwnerMarketplaceAppSummaryView; t: Translate }): JSX.Element {
  const { item, t } = props;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <StatusBadge tone={item.publishStatus === 'published' ? 'success' : item.publishStatus === 'rejected' ? 'danger' : 'pending'}>
        {t(`apps.publishStatus.${item.publishStatus}`)}
      </StatusBadge>
      <StatusBadge tone={item.ownerVisibility === 'public' ? 'info' : 'muted'}>
        {t(`apps.visibility.${item.ownerVisibility}`)}
      </StatusBadge>
    </div>
  );
}

function AppDetailSurface(props: {
  locale: LocaleCode;
  t: Translate;
  detailError: unknown;
  detailItem?: OwnerMarketplaceAppDetailView;
  detailLoading: boolean;
  manageError: unknown;
  pending: boolean;
  pendingAction: OwnerMarketplaceAppManageAction | null;
  resolvedSelector: string | null;
  onManage: (action: OwnerMarketplaceAppManageAction) => void;
}): JSX.Element {
  const { locale, t, detailError, detailItem, detailLoading, manageError, pending, pendingAction, resolvedSelector, onManage } = props;
  return (
    <ConsoleSurface className="p-5">
      {!resolvedSelector ? (
        <p className="text-sm text-[#8f8a7d]">{t('apps.messages.selectOne')}</p>
      ) : detailLoading ? (
        <p className="text-sm text-[#8f8a7d]">{t('apps.messages.loadingDetail')}</p>
      ) : detailError instanceof Error ? (
        <p className="text-sm text-rose-600">{detailError.message}</p>
      ) : detailItem ? (
        <AppDetailPanel
          item={detailItem}
          locale={locale}
          t={t}
          pending={pending}
          pendingAction={pendingAction}
          onManage={onManage}
        />
      ) : (
        <p className="text-sm text-[#8f8a7d]">{t('apps.messages.selectOne')}</p>
      )}
      {manageError instanceof Error ? <p className="mt-4 text-sm text-rose-600">{manageError.message}</p> : null}
    </ConsoleSurface>
  );
}

function AppDetailPanel(props: {
  item: OwnerMarketplaceAppDetailView;
  locale: LocaleCode;
  t: Translate;
  pending: boolean;
  pendingAction: OwnerMarketplaceAppManageAction | null;
  onManage: (action: OwnerMarketplaceAppManageAction) => void;
}): JSX.Element {
  const { item, locale, t, pending, pendingAction, onManage } = props;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8f8a7d]">{item.publisher.name}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1f1f1d]">{item.name}</h2>
          <p className="mt-2 text-sm text-[#656561]">{item.appId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={item.publishStatus === 'published' ? 'success' : item.publishStatus === 'rejected' ? 'danger' : 'pending'}>
            {t(`apps.publishStatus.${item.publishStatus}`)}
          </StatusBadge>
          <StatusBadge tone={item.ownerVisibility === 'public' ? 'info' : 'muted'}>
            {t(`apps.visibility.${item.ownerVisibility}`)}
          </StatusBadge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <MetaItem label={t('apps.fields.scope')} value={`@${item.ownerScope}`} />
        <MetaItem label={t('apps.fields.appId')} value={item.appId} />
        <MetaItem label={t('apps.fields.publishedAt')} value={formatDateTime(locale, item.publishedAt)} />
        <MetaItem label={t('apps.fields.updatedAt')} value={formatDateTime(locale, item.updatedAt)} />
        <MetaItem
          label={t('apps.fields.reviewedAt')}
          value={item.reviewedAt ? formatDateTime(locale, item.reviewedAt) : t('apps.values.notReviewed')}
        />
        <MetaItem label={t('apps.fields.install')} value={item.install.command} />
      </div>

      <div>
        <p className="text-xs text-[#8f8a7d]">{t('apps.fields.summary')}</p>
        <p className="mt-1 text-sm text-[#656561]">{item.summary}</p>
      </div>

      {item.description ? (
        <div>
          <p className="text-xs text-[#8f8a7d]">{t('apps.fields.description')}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[#656561]">{item.description}</p>
        </div>
      ) : null}

      {item.reviewNote ? (
        <div>
          <p className="text-xs text-[#8f8a7d]">{t('apps.fields.reviewNote')}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[#656561]">{item.reviewNote}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#f3f2ee] px-2.5 py-1 text-xs text-[#656561]">{tag}</span>
        ))}
      </div>

      <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-4">
        <p className="text-sm font-medium text-[#1f1f1d]">{t('apps.actions.manageTitle')}</p>
        <p className="mt-1 text-sm text-[#656561]">{t('apps.actions.manageDescription')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={!item.canHide || pending} onClick={() => onManage('hide')}>
            {pending && pendingAction === 'hide' ? t('apps.actions.hiding') : t('apps.actions.hide')}
          </Button>
          <Button type="button" variant="secondary" disabled={!item.canShow || pending} onClick={() => onManage('show')}>
            {pending && pendingAction === 'show' ? t('apps.actions.showing') : t('apps.actions.show')}
          </Button>
          <Button type="button" variant="ghost" disabled={!item.canDelete || pending} onClick={() => onManage('delete')}>
            {pending && pendingAction === 'delete' ? t('apps.actions.deleting') : t('apps.actions.delete')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => window.open(item.webUrl, '_blank', 'noopener,noreferrer')}>
            {t('apps.actions.openStore')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaItem(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[#8f8a7d]">{props.label}</p>
      <p className="mt-2 break-all text-sm text-[#1f1f1d]">{props.value}</p>
    </div>
  );
}

function StatusBadge(props: { tone: 'success' | 'danger' | 'pending' | 'info' | 'muted'; children: string }): JSX.Element {
  const className = props.tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : props.tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : props.tone === 'pending'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : props.tone === 'info'
          ? 'border-brand-200 bg-brand-50 text-brand-700'
          : 'border-[#e4e0d7] bg-[#f3f2ee] text-[#656561]';
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>{props.children}</span>;
}

function resolveSelectedSelector(
  selectedSelector: string | null,
  items: OwnerMarketplaceAppSummaryView[],
): string | null {
  if (selectedSelector && items.some((item) => item.appId === selectedSelector)) {
    return selectedSelector;
  }
  return items[0]?.appId ?? null;
}
