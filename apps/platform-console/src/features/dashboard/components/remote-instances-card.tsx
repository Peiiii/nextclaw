import type { FormEvent } from 'react';
import type { RemoteInstance } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/shared/components/data-table';
import { Input } from '@/components/ui/input';
import { RemoteShareGrantPanel } from '@/features/dashboard/components/remote-share-grant-panel';
import { useRemoteInstanceActions } from '@/features/dashboard/hooks/use-remote-instance-actions';
import { useRemoteInstanceList } from '@/features/dashboard/hooks/use-remote-instance-list';
import { formatDateTime, type LocaleCode } from '@/i18n/i18n.service';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type RemoteInstancesCardProps = {
  locale: LocaleCode;
  t: Translate;
  token: string;
};

export function RemoteInstancesCard(props: RemoteInstancesCardProps): JSX.Element {
  const list = useRemoteInstanceList({ token: props.token });
  const actions = useRemoteInstanceActions({
    token: props.token,
    t: props.t,
    onInstanceListChanged: list.resetPage
  });
  const page = list.query.data;
  const instances = page?.items ?? [];
  const hasActiveFilters = list.listQuery.archiveStatus !== 'active'
    || list.listQuery.connectionStatus !== 'all'
    || Boolean(list.listQuery.q);
  const columns = createRemoteInstanceColumns(props, actions);

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    list.applySearch();
    actions.commands.selectInstance(null);
  }

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="space-y-1">
        <CardTitle>{props.t('remote.title')}</CardTitle>
        <p className="text-sm leading-6 text-[#656561]">{props.t('remote.description')}</p>
      </div>

      <DataTable
        columns={columns}
        rows={instances}
        rowKey={(instance) => instance.id}
        minWidth={1020}
        loading={list.query.isLoading}
        loadingLabel={props.t('remote.messages.loadingInstances')}
        empty={hasActiveFilters ? props.t('remote.messages.filteredEmpty') : props.t('remote.messages.empty')}
        toolbar={(
          <RemoteInstanceTableToolbar
            t={props.t}
            list={list}
            hasActiveFilters={hasActiveFilters}
            onSearch={handleSearch}
            onListScopeChanged={() => actions.commands.selectInstance(null)}
          />
        )}
        sorting={{
          columnKey: list.listQuery.sortBy,
          direction: list.listQuery.sortDirection,
          onChange: (columnKey, direction) => {
            if (columnKey === 'displayName' || columnKey === 'lastSeenAt') {
              list.setSorting(columnKey, direction);
            }
          }
        }}
        pagination={{
          page: page?.page ?? list.listQuery.page,
          pageSize: page?.pageSize ?? list.listQuery.pageSize,
          total: page?.total ?? 0,
          pageSizeOptions: [10, 20, 50],
          labels: {
            pageSize: props.t('remote.pagination.pageSize'),
            previous: props.t('remote.pagination.previous'),
            next: props.t('remote.pagination.next'),
            summary: (from, to, total) => props.t('remote.pagination.summary', { from, to, total })
          },
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize
        }}
      />

      <RemoteInstanceErrors list={list} actions={actions} t={props.t} />
      {actions.state.feedback ? <p className="text-sm text-[#656561]" role="status">{actions.state.feedback}</p> : null}

      {actions.state.selectedInstanceId ? (
        <RemoteShareGrantPanel
          locale={props.locale}
          t={props.t}
          instanceId={actions.state.selectedInstanceId}
          grants={actions.queries.remoteShareGrants.data?.items ?? []}
          isLoading={actions.queries.remoteShareGrants.isLoading}
          error={actions.queries.remoteShareGrants.error}
          isCreatingShare={actions.mutations.createShare.isPending}
          isRevokingShare={actions.mutations.revokeShare.isPending}
          onClose={() => actions.commands.selectInstance(null)}
          onCreateShare={(instanceId) => void actions.mutations.createShare.mutateAsync(instanceId)}
          onCopyShareUrl={(shareUrl) => void actions.commands.copyShareUrl(shareUrl)}
          onRevokeShare={(grantId, instanceId) => actions.mutations.revokeShare.mutate({ grantId, instanceId })}
        />
      ) : null}
    </Card>
  );
}

function createRemoteInstanceColumns(
  props: RemoteInstancesCardProps,
  actions: ReturnType<typeof useRemoteInstanceActions>
): DataTableColumn<RemoteInstance>[] {
  return [
    {
      key: 'displayName',
      title: props.t('remote.table.instance'),
      width: 300,
      fixed: 'left',
      sortable: true,
      render: (instance) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-[#1f1f1d]" title={instance.displayName}>
              {instance.displayName}
            </span>
            <span className="shrink-0 rounded-md bg-[#f3f2ee] px-1.5 py-0.5 text-[11px] text-[#656561]">
              {instance.appVersion}
            </span>
          </div>
          <button
            type="button"
            aria-label={props.t('remote.actions.copyInstanceId', { instanceId: instance.id })}
            className="mt-1 max-w-full truncate rounded font-mono text-xs text-[#8f8a7d] outline-none hover:text-[#1f1f1d] hover:underline focus-visible:ring-2 focus-visible:ring-brand-200"
            title={props.t('remote.actions.copyInstanceId', { instanceId: instance.id })}
            onClick={() => void actions.commands.copyInstanceId(instance.id)}
          >
            ID: {instance.id}
          </button>
          {instance.archivedAt ? (
            <div className="mt-1 text-xs text-[#a7a08f]">
              {props.t('remote.archived.archivedAt', {
                archivedAt: formatDateTime(props.locale, instance.archivedAt)
              })}
            </div>
          ) : null}
        </div>
      )
    },
    {
      key: 'platform',
      title: props.t('remote.table.platform'),
      width: 120,
      render: (instance) => <span className="capitalize">{instance.platform}</span>
    },
    {
      key: 'status',
      title: props.t('remote.table.status'),
      width: 130,
      render: (instance) => <RemoteInstanceStatus instance={instance} t={props.t} />
    },
    {
      key: 'lastSeenAt',
      title: props.t('remote.table.lastSeenAt'),
      width: 190,
      sortable: true,
      defaultSortDirection: 'desc',
      render: (instance) => formatDateTime(props.locale, instance.lastSeenAt)
    },
    {
      key: 'actions',
      title: props.t('remote.table.actions'),
      width: 280,
      align: 'right',
      fixed: 'right',
      render: (instance) => (
        <RemoteInstanceActions
          instance={instance}
          t={props.t}
          isArchiving={actions.mutations.archive.isPending}
          isDeleting={actions.mutations.delete.isPending}
          isOpening={actions.mutations.open.isPending}
          isRestoring={actions.mutations.restore.isPending}
          onArchive={actions.commands.archiveInstance}
          onDelete={actions.commands.deleteInstance}
          onOpen={(instanceId, entry) => actions.mutations.open.mutate({ instanceId, entry })}
          onRestore={actions.commands.restoreInstance}
          onSelectShares={actions.commands.selectInstance}
        />
      )
    }
  ];
}

function RemoteInstanceTableToolbar(props: {
  t: Translate;
  list: ReturnType<typeof useRemoteInstanceList>;
  hasActiveFilters: boolean;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onListScopeChanged: () => void;
}): JSX.Element {
  return (
    <div className="space-y-3 rounded-xl border border-[#e4e0d7] bg-[#f9f8f5] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-lg border border-[#d9d3c5] bg-white p-1"
          role="group"
          aria-label={props.t('remote.filters.archiveLabel')}
        >
          {(['active', 'archived', 'all'] as const).map((archiveStatus) => (
            <button
              key={archiveStatus}
              type="button"
              aria-pressed={props.list.listQuery.archiveStatus === archiveStatus}
              className={props.list.listQuery.archiveStatus === archiveStatus
                ? 'rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white'
                : 'rounded-md px-3 py-1.5 text-xs font-medium text-[#656561] hover:bg-[#f3f2ee]'}
              onClick={() => {
                props.list.setArchiveStatus(archiveStatus);
                props.onListScopeChanged();
              }}
            >
              {props.t(`remote.filters.archive.${archiveStatus}`)}
            </button>
          ))}
        </div>
        {props.list.query.isFetching && !props.list.query.isLoading ? (
          <span className="text-xs text-[#8f8a7d]" role="status">{props.t('remote.messages.refreshing')}</span>
        ) : null}
      </div>

      <form className="flex flex-col gap-2 lg:flex-row lg:items-center" onSubmit={props.onSearch}>
        <Input
          className="lg:max-w-[360px]"
          value={props.list.searchInput}
          placeholder={props.t('remote.filters.searchPlaceholder')}
          aria-label={props.t('remote.filters.searchPlaceholder')}
          onChange={(event) => props.list.setSearchInput(event.target.value)}
        />
        <label className="flex items-center gap-2 text-xs text-[#656561]">
          <span className="shrink-0">{props.t('remote.filters.connectionLabel')}</span>
          <select
            className="h-10 min-w-[132px] rounded-lg border border-[#d9d3c5] bg-white px-3 text-sm text-[#1f1f1d] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={props.list.listQuery.connectionStatus}
            onChange={(event) => {
              props.list.setConnectionStatus(event.target.value as 'all' | 'online' | 'offline');
              props.onListScopeChanged();
            }}
          >
            <option value="all">{props.t('remote.filters.connection.all')}</option>
            <option value="online">{props.t('remote.filters.connection.online')}</option>
            <option value="offline">{props.t('remote.filters.connection.offline')}</option>
          </select>
        </label>
        <div className="flex items-center gap-2 lg:ml-auto">
          <Button type="submit" className="h-10">{props.t('remote.filters.search')}</Button>
          {props.hasActiveFilters || props.list.searchInput ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              onClick={() => {
                props.list.resetFilters();
                props.onListScopeChanged();
              }}
            >
              {props.t('remote.filters.reset')}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function RemoteInstanceStatus({ instance, t }: { instance: RemoteInstance; t: Translate }): JSX.Element {
  const status = instance.archivedAt ? 'archived' : instance.status;
  const className = status === 'online'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : status === 'archived'
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-[#f3f2ee] text-[#656561] ring-[#e4e0d7]';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${className}`}>
      {t(`remote.status.${status}`)}
    </span>
  );
}

function RemoteInstanceActions(props: {
  instance: RemoteInstance;
  t: Translate;
  isArchiving: boolean;
  isDeleting: boolean;
  isOpening: boolean;
  isRestoring: boolean;
  onArchive: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onOpen: (instanceId: string, entry: 'subdomain' | 'fixed_domain') => void;
  onRestore: (instanceId: string) => void;
  onSelectShares: (instanceId: string) => void;
}): JSX.Element {
  const { instance } = props;
  if (instance.archivedAt) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button type="button" variant="secondary" className="h-8 px-2 text-xs" disabled={props.isRestoring} onClick={() => props.onRestore(instance.id)}>
          {props.t('remote.actions.restore')}
        </Button>
        <Button type="button" variant="danger" className="h-8 px-2 text-xs" disabled={props.isDeleting} onClick={() => props.onDelete(instance.id)}>
          {props.t('remote.actions.delete')}
        </Button>
      </div>
    );
  }

  const isOffline = instance.status !== 'online';
  const offlineTitle = isOffline ? props.t('remote.actions.offlineHint') : undefined;
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        className="h-8 px-2 text-xs"
        title={offlineTitle}
        disabled={isOffline || props.isOpening}
        onClick={() => props.onOpen(instance.id, 'subdomain')}
      >
        {props.t('remote.actions.open')}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="h-8 px-2 text-xs"
        title={offlineTitle}
        disabled={isOffline || props.isOpening}
        onClick={() => props.onOpen(instance.id, 'fixed_domain')}
      >
        {props.t('remote.actions.fixedDomain')}
      </Button>
      <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => props.onSelectShares(instance.id)}>
        {props.t('remote.actions.shares')}
      </Button>
      <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={props.isArchiving} onClick={() => props.onArchive(instance.id)}>
        {props.t('remote.actions.archive')}
      </Button>
    </div>
  );
}

function RemoteInstanceErrors(props: {
  list: ReturnType<typeof useRemoteInstanceList>;
  actions: ReturnType<typeof useRemoteInstanceActions>;
  t: Translate;
}): JSX.Element | null {
  const errors = [
    [props.list.query.error, 'remote.messages.loadInstancesFailed'],
    [props.actions.mutations.open.error, 'remote.messages.openInstanceFailed'],
    [props.actions.mutations.createShare.error, 'remote.messages.createShareFailed'],
    [props.actions.mutations.revokeShare.error, 'remote.messages.revokeShareFailed'],
    [props.actions.mutations.archive.error, 'remote.messages.archiveFailed'],
    [props.actions.mutations.restore.error, 'remote.messages.restoreFailed'],
    [props.actions.mutations.delete.error, 'remote.messages.deleteFailed']
  ] as const;
  const activeErrors = errors.filter(([error]) => Boolean(error));
  if (activeErrors.length === 0) {
    return null;
  }
  return (
    <div className="space-y-1" role="alert">
      {activeErrors.map(([error, fallback]) => (
        <p key={fallback} className="text-sm text-rose-600">
          {error instanceof Error ? error.message : props.t(fallback)}
        </p>
      ))}
    </div>
  );
}
