/* eslint-disable max-lines-per-function */
import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import { Tabs } from '@/components/ui/tabs-custom';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  fetchMcpMarketplaceContent,
  doctorMcpMarketplaceItem
} from '@/api/mcp-marketplace';
import {
  useInstallMcpMarketplaceItem,
  useManageMcpMarketplaceItem,
  useMcpMarketplaceInstalled,
  useMcpMarketplaceItems
} from '@/hooks/useMcpMarketplace';
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceMcpDoctorResult,
  MarketplaceMcpInstallSpec,
  MarketplaceSort
} from '@/api/types';
import { useDocBrowser } from '@/components/doc-browser';
import { useI18n } from '@/components/providers/I18nProvider';
import {
  buildLocaleFallbacks,
  pickInstalledRecordDescription,
  pickLocalizedText
} from '@/components/marketplace/marketplace-localization';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type ScopeType = 'catalog' | 'installed';

const PAGE_SIZE = 12;

function normalizeMarketplaceKey(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function buildInstalledRecordLookup(records: MarketplaceInstalledRecord[]): Map<string, MarketplaceInstalledRecord> {
  const lookup = new Map<string, MarketplaceInstalledRecord>();

  for (const record of records) {
    const candidates = [record.catalogSlug, record.spec, record.id, record.label];
    for (const candidate of candidates) {
      const normalized = normalizeMarketplaceKey(candidate);
      if (!normalized || lookup.has(normalized)) {
        continue;
      }
      lookup.set(normalized, record);
    }
  }

  return lookup;
}

function findInstalledRecordForItem(
  item: MarketplaceItemSummary,
  installedRecordLookup: Map<string, MarketplaceInstalledRecord>
): MarketplaceInstalledRecord | undefined {
  const candidates = [item.slug, item.install.spec, item.id, item.name];
  for (const candidate of candidates) {
    const normalized = normalizeMarketplaceKey(candidate);
    if (!normalized) {
      continue;
    }
    const record = installedRecordLookup.get(normalized);
    if (record) {
      return record;
    }
  }
  return undefined;
}

function buildDocDataUrl(title: string, metadata: string, content: string, sourceUrl?: string, summary?: string): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(title)}</title>
    <style>
      body { margin: 0; background: #f8fafc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px 40px; }
      .hero { border: 1px solid #dbeafe; border-radius: 16px; background: linear-gradient(180deg, #eff6ff, #ffffff); padding: 20px; }
      .hero h1 { margin: 0; font-size: 26px; }
      .grid { display: grid; grid-template-columns: 280px 1fr; gap: 14px; margin-top: 16px; }
      .card { border: 1px solid #e2e8f0; background: #fff; border-radius: 14px; overflow: hidden; }
      .card h2 { margin: 0; padding: 12px 14px; font-size: 13px; font-weight: 700; color: #1d4ed8; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
      .body { padding: 12px 14px; }
      pre { margin: 0; white-space: pre-wrap; line-height: 1.7; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      a { color: #2563eb; text-decoration: none; }
      @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <h1>${escape(title)}</h1>
        ${summary ? `<p>${escape(summary)}</p>` : ''}
        ${sourceUrl ? `<p><a href="${escape(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(sourceUrl)}</a></p>` : ''}
      </section>
      <section class="grid">
        <article class="card">
          <h2>Metadata</h2>
          <div class="body"><pre>${escape(metadata)}</pre></div>
        </article>
        <article class="card">
          <h2>Content</h2>
          <div class="body"><pre>${escape(content)}</pre></div>
        </article>
      </section>
    </main>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function readSummary(localeFallbacks: string[], item?: MarketplaceItemSummary, record?: MarketplaceInstalledRecord): string {
  const localizedSummary = pickLocalizedText(item?.summaryI18n, item?.summary, localeFallbacks);
  if (localizedSummary) {
    return localizedSummary;
  }

  const localizedRecordDescription = pickInstalledRecordDescription(record, localeFallbacks);
  return localizedRecordDescription || t('marketplaceInstalledLocalSummary');
}

function readTransportLabel(item?: MarketplaceItemSummary, record?: MarketplaceInstalledRecord): string {
  if (record?.transport) {
    return record.transport.toUpperCase();
  }
  const install = item?.install as MarketplaceMcpInstallSpec | undefined;
  return (install?.transportTypes ?? []).map((entry) => entry.toUpperCase()).join(' / ') || 'MCP';
}

function InstallDialog(props: {
  item: MarketplaceItemSummary | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { name: string; allAgents: boolean; inputs: Record<string, string> }) => Promise<void>;
}) {
  const template = props.item?.install as MarketplaceMcpInstallSpec | undefined;
  const [name, setName] = useState('');
  const [allAgents, setAllAgents] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(template?.defaultName ?? '');
    setAllAgents(true);
    setInputs(
      Object.fromEntries((template?.inputs ?? []).map((field) => [field.id, field.defaultValue ?? '']))
    );
  }, [template, props.open]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('marketplaceMcpInstallDialogTitle')}</DialogTitle>
          <DialogDescription>{props.item?.name ?? '-'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-800">{t('marketplaceMcpServerName')}</div>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={template?.defaultName ?? 'mcp-server'} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-3">
            <div>
              <div className="text-sm font-medium text-gray-900">{t('marketplaceMcpAllAgents')}</div>
              <div className="text-xs text-gray-500">{t('marketplaceMcpAllAgentsDescription')}</div>
            </div>
            <Switch checked={allAgents} onCheckedChange={setAllAgents} />
          </div>

          {(template?.inputs ?? []).map((field) => (
            <div key={field.id} className="space-y-2">
              <div className="text-sm font-medium text-gray-800">{field.label}</div>
              {field.description && <div className="text-xs text-gray-500">{field.description}</div>}
              <Input
                type={field.secret ? 'password' : 'text'}
                value={inputs[field.id] ?? ''}
                onChange={(event) => setInputs((current) => ({ ...current, [field.id]: event.target.value }))}
                placeholder={field.defaultValue ?? ''}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.pending}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => void props.onSubmit({ name, allAgents, inputs })}
            disabled={props.pending || !name.trim()}
          >
            {props.pending ? t('marketplaceInstalling') : t('marketplaceInstall')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DoctorDialog(props: {
  result: MarketplaceMcpDoctorResult | null;
  targetName: string | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('marketplaceMcpDoctorTitle')}</DialogTitle>
          <DialogDescription>{props.targetName ?? '-'}</DialogDescription>
        </DialogHeader>
        {props.pending && <div className="text-sm text-gray-500">{t('loading')}</div>}
        {!props.pending && props.result && (
          <div className="space-y-3 text-sm text-gray-700">
            <div>{t('marketplaceMcpDoctorAccessible')}: {props.result.accessible ? t('statusReady') : t('marketplaceOperationFailed')}</div>
            <div>{t('marketplaceMcpDoctorTransport')}: {props.result.transport.toUpperCase()}</div>
            <div>{t('marketplaceMcpDoctorTools')}: {props.result.toolCount}</div>
            {props.result.error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-rose-600">{props.result.error}</div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function McpMarketplacePage() {
  const [scope, setScope] = useState<ScopeType>('catalog');
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MarketplaceSort>('relevance');
  const [page, setPage] = useState(1);
  const [installingItem, setInstallingItem] = useState<MarketplaceItemSummary | null>(null);
  const [doctorTarget, setDoctorTarget] = useState<string | null>(null);
  const [doctorResult, setDoctorResult] = useState<MarketplaceMcpDoctorResult | null>(null);
  const { language } = useI18n();
  const docBrowser = useDocBrowser();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const localeFallbacks = useMemo(() => buildLocaleFallbacks(language), [language]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(searchText.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const itemsQuery = useMcpMarketplaceItems({
    q: query || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE
  });
  const installedQuery = useMcpMarketplaceInstalled();

  const installMutation = useInstallMcpMarketplaceItem();
  const manageMutation = useManageMcpMarketplaceItem();
  const doctorMutation = useMutation({
    mutationFn: doctorMcpMarketplaceItem,
    onSuccess: (result, name) => {
      setDoctorTarget(name);
      setDoctorResult(result);
    }
  });

  const installedRecordLookup = useMemo(() => {
    return buildInstalledRecordLookup(installedQuery.data?.records ?? []);
  }, [installedQuery.data?.records]);

  const installedRecords = useMemo(() => {
    const entries = installedQuery.data?.records ?? [];
    return entries.filter((record) => {
      const text = [
        record.id ?? '',
        record.label ?? '',
        record.catalogSlug ?? '',
        record.description ?? '',
        record.descriptionZh ?? ''
      ].join(' ').toLowerCase();
      return query ? text.includes(query.toLowerCase()) : true;
    });
  }, [installedQuery.data?.records, query]);

  const openDoc = async (item?: MarketplaceItemSummary, record?: MarketplaceInstalledRecord) => {
    const title = item?.name ?? record?.label ?? record?.id ?? 'MCP';
    const summary = readSummary(localeFallbacks, item, record);
    if (!item) {
      const url = buildDocDataUrl(
        title,
        JSON.stringify(record ?? {}, null, 2),
        t('marketplaceInstalledLocalSummary'),
        record?.docsUrl,
        summary
      );
      docBrowser.open(url, { newTab: true, title, kind: 'content' });
      return;
    }
    try {
      const content = await fetchMcpMarketplaceContent(item.slug);
      const url = buildDocDataUrl(
        title,
        content.metadataRaw || JSON.stringify(item, null, 2),
        content.bodyRaw || content.raw,
        content.sourceUrl,
        summary
      );
      docBrowser.open(url, { newTab: true, title, kind: 'content' });
    } catch (error) {
      const url = buildDocDataUrl(
        title,
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2),
        summary,
        undefined,
        summary
      );
      docBrowser.open(url, { newTab: true, title, kind: 'content' });
    }
  };

  const handleInstall = async (payload: { name: string; allAgents: boolean; inputs: Record<string, string> }) => {
    if (!installingItem) {
      return;
    }
    await installMutation.mutateAsync({
      spec: installingItem.slug,
      name: payload.name.trim(),
      allAgents: payload.allAgents,
      inputs: payload.inputs
    });
    setInstallingItem(null);
  };

  const handleManage = async (action: 'enable' | 'disable' | 'remove', record: MarketplaceInstalledRecord) => {
    const target = record.id || record.spec;
    if (!target) {
      return;
    }
    if (action === 'remove') {
      const confirmed = await confirm({
        title: `${t('marketplaceMcpRemoveTitle')} ${target}?`,
        description: t('marketplaceMcpRemoveDescription'),
        confirmLabel: t('marketplaceMcpRemove'),
        variant: 'destructive'
      });
      if (!confirmed) {
        return;
      }
    }
    await manageMutation.mutateAsync({
      action,
      id: target,
      spec: record.spec
    });
  };

  const renderCard = (item?: MarketplaceItemSummary, record?: MarketplaceInstalledRecord) => {
    const installed = record ?? (item ? findInstalledRecordForItem(item, installedRecordLookup) : undefined);
    const name = item?.name ?? record?.label ?? record?.id ?? 'MCP';
    const summary = readSummary(localeFallbacks, item, record);
    const transport = readTransportLabel(item, record);
    const status = installed ? (installed.enabled === false ? t('marketplaceDisable') : t('statusReady')) : null;

    return (
      <article
        key={`${item?.id ?? record?.id ?? record?.spec}`}
        onClick={() => void openDoc(item, record)}
        className="cursor-pointer rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">{name}</div>
            <div className="mt-1 text-xs text-gray-500">{transport}</div>
            <div className="mt-2 line-clamp-2 text-sm text-gray-600">{summary}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(item?.tags ?? []).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{tag}</span>
              ))}
              {status && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">{status}</span>}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {!installed && item && (
              <button
                className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  setInstallingItem(item);
                }}
              >
                {t('marketplaceInstall')}
              </button>
            )}

            {installed && (
              <>
                <button
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleManage(installed.enabled === false ? 'enable' : 'disable', installed);
                  }}
                >
                  {installed.enabled === false ? t('marketplaceEnable') : t('marketplaceDisable')}
                </button>
                <button
                  className="rounded-xl border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDoctorTarget(installed.id ?? null);
                    setDoctorResult(null);
                    void doctorMutation.mutateAsync(installed.id ?? '');
                  }}
                >
                  {t('marketplaceMcpDoctor')}
                </button>
                <button
                  className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleManage('remove', installed);
                  }}
                >
                  {t('marketplaceMcpRemove')}
                </button>
              </>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <PageLayout className="flex h-full min-h-0 flex-col pb-0">
      <PageHeader title={t('marketplaceMcpPageTitle')} description={t('marketplaceMcpPageDescription')} />

      <Tabs
        tabs={[
          { id: 'catalog', label: t('marketplaceMcpTabCatalog') },
          { id: 'installed', label: t('marketplaceMcpTabInstalled'), count: installedQuery.data?.total ?? 0 }
        ]}
        activeTab={scope}
        onChange={(value) => setScope(value as ScopeType)}
        className="mb-4"
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={t('marketplaceMcpSearchPlaceholder')}
          className="md:max-w-sm"
        />

        <Select value={sort} onValueChange={(value) => setSort(value as MarketplaceSort)}>
          <SelectTrigger className="h-9 w-[180px] rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">{t('marketplaceSortRelevance')}</SelectItem>
            <SelectItem value="updated">{t('marketplaceSortUpdated')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {scope === 'catalog' ? t('marketplaceMcpSectionCatalog') : t('marketplaceMcpSectionInstalled')}
          </h3>
          <span className="text-xs text-gray-500">
            {scope === 'catalog' ? (itemsQuery.data?.total ?? 0) : (installedQuery.data?.total ?? 0)}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3')}>
            {scope === 'catalog' && itemsQuery.isLoading && Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-20" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </div>
            ))}

            {scope === 'catalog' && !itemsQuery.isLoading && (itemsQuery.data?.items ?? []).map((item) => renderCard(item))}
            {scope === 'installed' && installedRecords.map((record) => renderCard(undefined, record))}
          </div>

          {scope === 'catalog' && itemsQuery.isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {itemsQuery.error.message}
            </div>
          )}
          {scope === 'installed' && installedQuery.isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {installedQuery.error.message}
            </div>
          )}
          {scope === 'catalog' && !itemsQuery.isLoading && (itemsQuery.data?.items?.length ?? 0) === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">{t('marketplaceNoMcp')}</div>
          )}
          {scope === 'installed' && installedRecords.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">{t('marketplaceNoInstalledMcp')}</div>
          )}
        </div>
      </section>

      {scope === 'catalog' && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            className="h-8 rounded-xl border border-gray-200/80 px-3 text-sm text-gray-600 disabled:opacity-40"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || itemsQuery.isFetching}
          >
            {t('prev')}
          </button>
          <div className="min-w-20 text-center text-sm text-gray-600">
            {itemsQuery.data?.totalPages ? `${page} / ${itemsQuery.data.totalPages}` : '0 / 0'}
          </div>
          <button
            className="h-8 rounded-xl border border-gray-200/80 px-3 text-sm text-gray-600 disabled:opacity-40"
            onClick={() => setPage((current) => current + 1)}
            disabled={!itemsQuery.data?.totalPages || page >= itemsQuery.data.totalPages || itemsQuery.isFetching}
          >
            {t('next')}
          </button>
        </div>
      )}

      <InstallDialog
        item={installingItem}
        open={Boolean(installingItem)}
        pending={installMutation.isPending}
        onOpenChange={(open) => !open && setInstallingItem(null)}
        onSubmit={handleInstall}
      />
      <DoctorDialog
        open={Boolean(doctorTarget)}
        targetName={doctorTarget}
        result={doctorResult}
        pending={doctorMutation.isPending}
        onOpenChange={(open) => !open && setDoctorTarget(null)}
      />
      <ConfirmDialog />
    </PageLayout>
  );
}
