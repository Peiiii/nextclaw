import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchOwnerMarketplaceSkillDetail,
  fetchOwnerMarketplaceSkills,
  manageOwnerMarketplaceSkill,
} from '@/api/marketplace-owner-client';
import type {
  OwnerMarketplaceSkillDetailView,
  OwnerMarketplaceSkillManageAction,
  OwnerMarketplaceSkillSummaryView,
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

export function UserSkillsPage({ token, t }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['owner-marketplace-skills', searchQuery],
    queryFn: async () => await fetchOwnerMarketplaceSkills(token, { q: searchQuery }),
  });

  const items = listQuery.data?.items ?? [];
  const resolvedSelector = resolveSelectedSelector(selectedSelector, items);
  const detailQuery = useQuery({
    queryKey: ['owner-marketplace-skill-detail', resolvedSelector],
    enabled: Boolean(resolvedSelector),
    queryFn: async () => await fetchOwnerMarketplaceSkillDetail(token, resolvedSelector ?? ''),
  });

  const manageMutation = useMutation({
    mutationFn: async (params: { selector: string; action: OwnerMarketplaceSkillManageAction }) =>
      await manageOwnerMarketplaceSkill(token, params.selector, params.action),
    onSuccess: async (data, variables) => {
      if (variables.action === 'delete') {
        setSelectedSelector((current) => (current === variables.selector ? null : current));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['owner-marketplace-skills'] }),
        queryClient.invalidateQueries({ queryKey: ['owner-marketplace-skill-detail', variables.selector] }),
      ]);
      queryClient.setQueryData<OwnerMarketplaceSkillDetailView | undefined>(
        ['owner-marketplace-skill-detail', variables.selector],
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
    manageMutation.variables?.selector === detailQuery.data?.packageName
      ? manageMutation.variables?.action ?? null
      : null;

  return (
    <ConsolePage>
      <ConsoleMetricGrid>
        <ConsoleMetricCard
          label={t('skills.metrics.total')}
          value={String(metrics.total)}
          hint={t('skills.metrics.totalHint')}
        />
        <ConsoleMetricCard
          label={t('skills.metrics.live')}
          value={String(metrics.liveCount)}
          hint={t('skills.metrics.liveHint')}
        />
        <ConsoleMetricCard
          label={t('skills.metrics.hidden')}
          value={String(metrics.hiddenCount)}
          hint={t('skills.metrics.hiddenHint')}
        />
        <ConsoleMetricCard
          label={t('skills.metrics.pending')}
          value={String(metrics.pendingCount)}
          hint={t('skills.metrics.pendingHint')}
        />
      </ConsoleMetricGrid>

      <SkillsManagementSection
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
          if (action === 'delete' && !window.confirm(t('skills.messages.deleteConfirm'))) {
            return;
          }
          manageMutation.mutate({
            selector: detailQuery.data.packageName,
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

function SkillsManagementSection(props: {
  items: OwnerMarketplaceSkillSummaryView[];
  locale: LocaleCode;
  resolvedSelector: string | null;
  searchInput: string;
  t: Translate;
  detailError: unknown;
  detailItem?: OwnerMarketplaceSkillDetailView;
  detailLoading: boolean;
  listError: unknown;
  listLoading: boolean;
  manageError: unknown;
  pending: boolean;
  pendingAction: OwnerMarketplaceSkillManageAction | null;
  onManage: (action: OwnerMarketplaceSkillManageAction) => void;
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
      title={t('skills.title')}
      description={t('skills.description')}
      actions={(
        <SkillsSearchActions
          searchInput={searchInput}
          t={t}
          onChange={onSearchInputChange}
          onClear={onSearchClear}
          onSearch={onSearchSubmit}
        />
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SkillsListPanel
          items={items}
          locale={locale}
          resolvedSelector={resolvedSelector}
          t={t}
          error={listError}
          loading={listLoading}
          onSelect={onSelect}
        />

        <ConsoleSurface className="p-5">
          {!resolvedSelector ? (
            <p className="text-sm text-[#8f8a7d]">{t('skills.messages.selectOne')}</p>
          ) : detailLoading ? (
            <p className="text-sm text-[#8f8a7d]">{t('skills.messages.loadingDetail')}</p>
          ) : detailError instanceof Error ? (
            <p className="text-sm text-rose-600">{detailError.message}</p>
          ) : detailItem ? (
            <SkillDetailPanel
              item={detailItem}
              locale={locale}
              t={t}
              pendingAction={pendingAction}
              pending={pending}
              onManage={onManage}
            />
          ) : (
            <p className="text-sm text-[#8f8a7d]">{t('skills.messages.selectOne')}</p>
          )}

          {manageError instanceof Error ? (
            <p className="mt-4 text-sm text-rose-600">{manageError.message}</p>
          ) : null}
        </ConsoleSurface>
      </div>
    </ConsoleSection>
  );
}

function SkillsSearchActions(props: {
  searchInput: string;
  t: Translate;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <>
      <Input
        value={props.searchInput}
        placeholder={props.t('skills.searchPlaceholder')}
        className="w-[240px]"
        onChange={(event) => props.onChange(event.target.value)}
      />
      <Button type="button" variant="secondary" onClick={props.onSearch}>
        {props.t('skills.actions.search')}
      </Button>
      <Button type="button" variant="ghost" onClick={props.onClear}>
        {props.t('skills.actions.clear')}
      </Button>
    </>
  );
}

function SkillsListPanel(props: {
  items: OwnerMarketplaceSkillSummaryView[];
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
        <p className="text-sm font-semibold text-[#1f1f1d]">{t('skills.queueTitle')}</p>
        <p className="mt-1 text-xs text-[#8f8a7d]">
          {t('skills.queueSummary', { count: items.length })}
        </p>
      </div>

      <div className="space-y-2 p-3">
        {loading ? <p className="px-1 py-6 text-sm text-[#8f8a7d]">{t('skills.messages.loading')}</p> : null}
        {error instanceof Error ? (
          <p className="px-1 py-3 text-sm text-rose-600">{error.message}</p>
        ) : null}
        {!loading && items.length === 0 ? (
          <p className="px-1 py-6 text-sm text-[#8f8a7d]">{t('skills.messages.empty')}</p>
        ) : null}

        {items.map((item) => {
          const selector = item.packageName;
          const isSelected = resolvedSelector === selector;
          return (
            <button
              key={item.id}
              type="button"
              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                isSelected
                  ? 'border-brand-300 bg-brand-50'
                  : 'border-[#e4e0d7] bg-[#f9f8f5] hover:border-[#d4cdbd] hover:bg-[#f3f2ee]'
              }`}
              onClick={() => onSelect(selector)}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1f1f1d]">{item.name}</p>
                  <p className="mt-1 truncate text-xs text-[#8f8a7d]">{item.packageName}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <SkillStatusBadge tone={readPublishStatusTone(item.publishStatus)}>
                    {t(`skills.publishStatus.${item.publishStatus}`)}
                  </SkillStatusBadge>
                  <SkillStatusBadge tone={item.ownerVisibility === 'hidden' ? 'warning' : 'success'}>
                    {t(`skills.visibility.${item.ownerVisibility}`)}
                  </SkillStatusBadge>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-[#656561]">{item.summary}</p>
              <p className="mt-3 text-xs text-[#8f8a7d]">
                {t('skills.updatedAt', { updatedAt: formatDateTime(locale, item.updatedAt) })}
              </p>
            </button>
          );
        })}
      </div>
    </ConsoleSurface>
  );
}

function SkillDetailPanel(props: {
  item: OwnerMarketplaceSkillDetailView;
  locale: LocaleCode;
  t: Translate;
  pending: boolean;
  pendingAction: OwnerMarketplaceSkillManageAction | null;
  onManage: (action: OwnerMarketplaceSkillManageAction) => void;
}): JSX.Element {
  const { item, locale, t, pending, pendingAction, onManage } = props;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#1f1f1d]">{item.name}</h3>
          <p className="mt-1 text-sm text-[#8f8a7d]">{item.packageName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SkillStatusBadge tone={readPublishStatusTone(item.publishStatus)}>
            {t(`skills.publishStatus.${item.publishStatus}`)}
          </SkillStatusBadge>
          <SkillStatusBadge tone={item.ownerVisibility === 'hidden' ? 'warning' : 'success'}>
            {t(`skills.visibility.${item.ownerVisibility}`)}
          </SkillStatusBadge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DetailMeta label={t('skills.fields.scope')} value={`@${item.ownerScope}`} />
        <DetailMeta label={t('skills.fields.updatedAt')} value={formatDateTime(locale, item.updatedAt)} />
        <DetailMeta label={t('skills.fields.publishedAt')} value={formatDateTime(locale, item.publishedAt)} />
        <DetailMeta
          label={t('skills.fields.reviewedAt')}
          value={item.reviewedAt ? formatDateTime(locale, item.reviewedAt) : t('skills.values.notReviewed')}
        />
      </div>

      <div>
        <p className="text-xs text-[#8f8a7d]">{t('skills.fields.summary')}</p>
        <p className="mt-1 text-sm leading-6 text-[#656561]">{item.summary}</p>
      </div>

      {item.description ? (
        <div>
          <p className="text-xs text-[#8f8a7d]">{t('skills.fields.description')}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#656561]">{item.description}</p>
        </div>
      ) : null}

      {item.reviewNote ? (
        <div className="rounded-2xl border border-[#f0ddbf] bg-[#fff8ee] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9b6b19]">{t('skills.fields.reviewNote')}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#7a5a23]">{item.reviewNote}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#f3f2ee] px-2.5 py-1 text-xs text-[#656561]">
            {tag}
          </span>
        ))}
      </div>

      <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] px-4 py-4">
        <p className="text-sm font-semibold text-[#1f1f1d]">{t('skills.actions.manageTitle')}</p>
        <p className="mt-2 text-sm leading-6 text-[#656561]">{t('skills.actions.manageDescription')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {item.canHide ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => onManage('hide')}
            >
              {pendingAction === 'hide' ? t('skills.actions.hiding') : t('skills.actions.hide')}
            </Button>
          ) : null}
          {item.canShow ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => onManage('show')}
            >
              {pendingAction === 'show' ? t('skills.actions.showing') : t('skills.actions.show')}
            </Button>
          ) : null}
          {item.canDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-rose-600 hover:text-rose-700"
              disabled={pending}
              onClick={() => onManage('delete')}
            >
              {pendingAction === 'delete' ? t('skills.actions.deleting') : t('skills.actions.delete')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailMeta(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-[#8f8a7d]">{props.label}</p>
      <p className="mt-2 text-sm font-medium text-[#1f1f1d]">{props.value}</p>
    </div>
  );
}

function SkillStatusBadge(props: {
  children: string;
  tone: 'success' | 'warning' | 'neutral' | 'danger';
}): JSX.Element {
  const toneClass =
    props.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : props.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : props.tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-[#ddd7c8] bg-white text-[#8f8a7d]';

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {props.children}
    </span>
  );
}

function readPublishStatusTone(status: OwnerMarketplaceSkillSummaryView['publishStatus']): 'success' | 'warning' | 'danger' {
  if (status === 'published') {
    return 'success';
  }
  if (status === 'rejected') {
    return 'danger';
  }
  return 'warning';
}

function resolveSelectedSelector(
  selectedSelector: string | null,
  items: OwnerMarketplaceSkillSummaryView[],
): string | null {
  if (!selectedSelector) {
    return items[0]?.packageName ?? null;
  }
  return items.some((item) => item.packageName === selectedSelector)
    ? selectedSelector
    : (items[0]?.packageName ?? null);
}
