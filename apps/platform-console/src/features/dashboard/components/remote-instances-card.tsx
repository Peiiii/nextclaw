import type { FormEvent } from "react";
import type { RemoteInstance } from "@/features/dashboard/types/remote-instance.types";
import { Button } from "@/shared/components/button";
import { CardTitle } from "@/shared/components/card";
import {
  DataTable,
  type DataTableColumn,
} from "@/shared/components/data-table";
import { Input } from "@/shared/components/input";
import {
  RemoteInstanceActions,
  RemoteInstanceIdentity,
  RemoteInstanceMobileCard,
  RemoteInstanceStatus,
  type RemoteInstanceTranslate,
} from "@/features/dashboard/components/remote-instance-list-item";
import { RemoteShareGrantPanel } from "@/features/dashboard/components/remote-share-grant-panel";
import { RemoteInstanceDomainEditor } from "@/features/dashboard/components/remote-instance-domain-editor";
import { useRemoteInstanceActions } from "@/features/dashboard/hooks/use-remote-instance-actions";
import { useRemoteInstanceList } from "@/features/dashboard/hooks/use-remote-instance-list";
import { formatDateTime, type LocaleCode } from "@/i18n/i18n.service";

type Translate = RemoteInstanceTranslate;

type RemoteInstancesCardProps = {
  locale: LocaleCode;
  t: Translate;
  token: string;
};

export function RemoteInstancesCard(
  props: RemoteInstancesCardProps,
): JSX.Element {
  const list = useRemoteInstanceList({ token: props.token });
  const actions = useRemoteInstanceActions({
    token: props.token,
    t: props.t,
    onInstanceListChanged: list.resetPage,
  });
  const page = list.query.data;
  const instances = page?.items ?? [];
  const hasActiveFilters =
    list.listQuery.archiveStatus !== "active" ||
    list.listQuery.connectionStatus !== "all" ||
    Boolean(list.listQuery.q);
  const columns = createRemoteInstanceColumns(props, actions);

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    list.applySearch();
    actions.commands.selectInstance(null);
  }

  return (
    <section className="space-y-3 sm:space-y-4 sm:rounded-2xl sm:border sm:border-[var(--color-border)] sm:bg-[var(--color-surface)] sm:p-5 sm:shadow-[0_1px_3px_rgba(31,31,29,0.04)]">
      <div className="hidden space-y-1 sm:block">
        <CardTitle>{props.t("remote.title")}</CardTitle>
        <p className="text-sm leading-6 text-[var(--color-foreground-muted)]">
          {props.t("remote.description")}
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={instances}
        rowKey={(instance) => instance.id}
        minWidth={1180}
        loading={list.query.isLoading}
        loadingLabel={props.t("remote.messages.loadingInstances")}
        empty={
          hasActiveFilters
            ? props.t("remote.messages.filteredEmpty")
            : props.t("remote.messages.empty")
        }
        renderMobileRow={(instance) => (
          <RemoteInstanceMobileCard
            instance={instance}
            locale={props.locale}
            t={props.t}
            actions={actions}
          />
        )}
        toolbar={
          <RemoteInstanceTableToolbar
            t={props.t}
            list={list}
            hasActiveFilters={hasActiveFilters}
            onSearch={handleSearch}
            onListScopeChanged={() => actions.commands.selectInstance(null)}
          />
        }
        sorting={{
          columnKey: list.listQuery.sortBy,
          direction: list.listQuery.sortDirection,
          onChange: (columnKey, direction) => {
            if (columnKey === "displayName" || columnKey === "lastSeenAt") {
              list.setSorting(columnKey, direction);
            }
          },
        }}
        pagination={{
          page: page?.page ?? list.listQuery.page,
          pageSize: page?.pageSize ?? list.listQuery.pageSize,
          total: page?.total ?? 0,
          pageSizeOptions: [10, 20, 50],
          labels: {
            pageSize: props.t("remote.pagination.pageSize"),
            previous: props.t("remote.pagination.previous"),
            next: props.t("remote.pagination.next"),
            summary: (from, to, total) =>
              props.t("remote.pagination.summary", { from, to, total }),
          },
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
        }}
      />

      <RemoteInstanceErrors list={list} actions={actions} t={props.t} />
      {actions.state.feedback ? (
        <p
          className="text-sm text-[var(--color-foreground-muted)]"
          role="status"
        >
          {actions.state.feedback}
        </p>
      ) : null}

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
          onCreateShare={(instanceId) =>
            void actions.mutations.createShare.mutateAsync(instanceId)
          }
          onCopyShareUrl={(shareUrl) =>
            void actions.commands.copyShareUrl(shareUrl)
          }
          onRevokeShare={(grantId, instanceId) =>
            actions.mutations.revokeShare.mutate({ grantId, instanceId })
          }
        />
      ) : null}
    </section>
  );
}

function createRemoteInstanceColumns(
  props: RemoteInstancesCardProps,
  actions: ReturnType<typeof useRemoteInstanceActions>,
): DataTableColumn<RemoteInstance>[] {
  return [
    {
      key: "displayName",
      title: props.t("remote.table.instance"),
      width: 300,
      fixed: "left",
      sortable: true,
      render: (instance) => (
        <RemoteInstanceIdentity
          instance={instance}
          locale={props.locale}
          t={props.t}
          onCopy={actions.commands.copyInstanceId}
        />
      ),
    },
    {
      key: "platform",
      title: props.t("remote.table.platform"),
      width: 120,
      render: (instance) => (
        <span className="capitalize">{instance.platform}</span>
      ),
    },
    {
      key: "stableDomain",
      title: props.t("remote.table.stableDomain"),
      width: 330,
      render: (instance) => (
        <RemoteInstanceDomainEditor
          instance={instance}
          t={props.t}
          isSaving={actions.mutations.updateDomain.isPending}
          isRemoving={actions.mutations.releaseDomain.isPending}
          onSave={async (instanceId, prefix) =>
            await actions.mutations.updateDomain.mutateAsync({
              instanceId,
              prefix,
            })
          }
          onRemove={async (instanceId) =>
            await actions.mutations.releaseDomain.mutateAsync(instanceId)
          }
        />
      ),
    },
    {
      key: "status",
      title: props.t("remote.table.status"),
      width: 130,
      render: (instance) => (
        <RemoteInstanceStatus instance={instance} t={props.t} />
      ),
    },
    {
      key: "lastSeenAt",
      title: props.t("remote.table.lastSeenAt"),
      width: 190,
      sortable: true,
      defaultSortDirection: "desc",
      render: (instance) => formatDateTime(props.locale, instance.lastSeenAt),
    },
    {
      key: "actions",
      title: props.t("remote.table.actions"),
      width: 220,
      align: "right",
      fixed: "right",
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
          onOpen={(instanceId) => actions.mutations.open.mutate(instanceId)}
          onRestore={actions.commands.restoreInstance}
          onSelectShares={actions.commands.selectInstance}
        />
      ),
    },
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
    <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 sm:space-y-3 sm:bg-[var(--color-canvas)] sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <div
          className="inline-flex min-w-0 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-0.5 sm:p-1"
          role="group"
          aria-label={props.t("remote.filters.archiveLabel")}
        >
          {(["active", "archived", "all"] as const).map((archiveStatus) => (
            <button
              key={archiveStatus}
              type="button"
              aria-pressed={
                props.list.listQuery.archiveStatus === archiveStatus
              }
              className={
                props.list.listQuery.archiveStatus === archiveStatus
                  ? "rounded-md bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white sm:px-3"
                  : "rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)] sm:px-3"
              }
              onClick={() => {
                props.list.setArchiveStatus(archiveStatus);
                props.onListScopeChanged();
              }}
            >
              {props.t(`remote.filters.archive.${archiveStatus}`)}
            </button>
          ))}
        </div>
        <label className="min-w-0 flex-1 sm:flex-none">
          <span className="sr-only">
            {props.t("remote.filters.connectionLabel")}
          </span>
          <select
            aria-label={props.t("remote.filters.connectionLabel")}
            className="h-9 w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-foreground)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:min-w-[132px] sm:px-3 sm:text-sm"
            value={props.list.listQuery.connectionStatus}
            onChange={(event) => {
              props.list.setConnectionStatus(
                event.target.value as "all" | "online" | "offline",
              );
              props.onListScopeChanged();
            }}
          >
            <option value="all">
              {props.t("remote.filters.connection.all")}
            </option>
            <option value="online">
              {props.t("remote.filters.connection.online")}
            </option>
            <option value="offline">
              {props.t("remote.filters.connection.offline")}
            </option>
          </select>
        </label>
        {props.list.query.isFetching && !props.list.query.isLoading ? (
          <span
            className="hidden text-xs text-[var(--color-foreground-subtle)] sm:inline"
            role="status"
          >
            {props.t("remote.messages.refreshing")}
          </span>
        ) : null}
      </div>

      <form
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center"
        onSubmit={props.onSearch}
      >
        <Input
          className="min-w-0 sm:max-w-[360px]"
          value={props.list.searchInput}
          placeholder={props.t("remote.filters.searchPlaceholder")}
          aria-label={props.t("remote.filters.searchPlaceholder")}
          onChange={(event) => props.list.setSearchInput(event.target.value)}
        />
        <div className="flex items-center gap-1 sm:ml-auto sm:gap-2">
          <Button type="submit" className="h-10 px-3 sm:flex-none">
            {props.t("remote.filters.search")}
          </Button>
          {props.hasActiveFilters || props.list.searchInput ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-2 sm:flex-none sm:px-3"
              onClick={() => {
                props.list.resetFilters();
                props.onListScopeChanged();
              }}
            >
              {props.t("remote.filters.reset")}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function RemoteInstanceErrors(props: {
  list: ReturnType<typeof useRemoteInstanceList>;
  actions: ReturnType<typeof useRemoteInstanceActions>;
  t: Translate;
}): JSX.Element | null {
  const errors = [
    [props.list.query.error, "remote.messages.loadInstancesFailed"],
    [props.actions.mutations.open.error, "remote.messages.openInstanceFailed"],
    [
      props.actions.mutations.createShare.error,
      "remote.messages.createShareFailed",
    ],
    [
      props.actions.mutations.revokeShare.error,
      "remote.messages.revokeShareFailed",
    ],
    [props.actions.mutations.archive.error, "remote.messages.archiveFailed"],
    [props.actions.mutations.restore.error, "remote.messages.restoreFailed"],
    [props.actions.mutations.delete.error, "remote.messages.deleteFailed"],
  ] as const;
  const activeErrors = errors.filter(([error]) => Boolean(error));
  const domainError = formatRemoteInstanceDomainError(
    props.actions.mutations.updateDomain.error,
    props.t,
  );
  const releaseDomainError = props.actions.mutations.releaseDomain.error
    ? props.t("remote.messages.releaseDomainFailed")
    : null;
  if (activeErrors.length === 0 && !domainError && !releaseDomainError) {
    return null;
  }
  return (
    <div className="space-y-1" role="alert">
      {activeErrors.map(([error, fallback]) => (
        <p key={fallback} className="text-sm text-rose-600">
          {error instanceof Error ? error.message : props.t(fallback)}
        </p>
      ))}
      {domainError ? (
        <p className="text-sm text-rose-600">{domainError}</p>
      ) : null}
      {releaseDomainError ? (
        <p className="text-sm text-rose-600">{releaseDomainError}</p>
      ) : null}
    </div>
  );
}

function formatRemoteInstanceDomainError(
  error: Error | null,
  t: Translate,
): string | null {
  if (!error) return null;
  if (error.message.includes("reserved"))
    return t("remote.domain.errors.reserved");
  if (error.message.includes("already in use"))
    return t("remote.domain.errors.taken");
  if (error.message.includes("1-63")) return t("remote.domain.errors.invalid");
  return t("remote.messages.updateDomainFailed");
}
