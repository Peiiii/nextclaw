import type { RemoteInstance } from "@/features/dashboard/types/remote-instance.types";
import { Button } from "@/shared/components/button";
import { RemoteInstanceDomainEditor } from "@/features/dashboard/components/remote-instance-domain-editor";
import type { useRemoteInstanceActions } from "@/features/dashboard/hooks/use-remote-instance-actions";
import { formatDateTime, type LocaleCode } from "@/i18n/i18n.service";

export type RemoteInstanceTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export function RemoteInstanceMobileCard(props: {
  instance: RemoteInstance;
  locale: LocaleCode;
  t: RemoteInstanceTranslate;
  actions: ReturnType<typeof useRemoteInstanceActions>;
}): JSX.Element {
  const { actions, instance } = props;
  return (
    <article
      data-testid="remote-instance-mobile-card"
      className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[0_1px_2px_rgba(31,31,29,0.04)]"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <RemoteInstanceIdentity
          instance={instance}
          locale={props.locale}
          t={props.t}
          onCopy={actions.commands.copyInstanceId}
        />
        <RemoteInstanceStatus instance={instance} t={props.t} />
      </div>
      <dl className="grid grid-cols-2 gap-3 border-y border-[var(--color-border-subtle)] py-2 text-xs">
        <div className="min-w-0">
          <dt className="text-[var(--color-foreground-subtle)]">
            {props.t("remote.table.platform")}
          </dt>
          <dd className="mt-1 truncate capitalize font-medium text-[var(--color-foreground)]">
            {instance.platform}
          </dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-[var(--color-foreground-subtle)]">
            {props.t("remote.table.lastSeenAt")}
          </dt>
          <dd className="mt-1 truncate font-medium text-[var(--color-foreground)]">
            {formatDateTime(props.locale, instance.lastSeenAt)}
          </dd>
        </div>
      </dl>
      <div className="rounded-lg bg-[var(--color-surface-muted)] px-2.5 py-2">
        <div className="mb-1 text-xs text-[var(--color-foreground-subtle)]">
          {props.t("remote.table.stableDomain")}
        </div>
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
      </div>
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
    </article>
  );
}

export function RemoteInstanceIdentity(props: {
  instance: RemoteInstance;
  locale: LocaleCode;
  t: RemoteInstanceTranslate;
  onCopy: (instanceId: string) => void;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="truncate font-medium text-[var(--color-foreground)]"
          title={props.instance.displayName}
        >
          {props.instance.displayName}
        </span>
        <span className="shrink-0 rounded-md bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[11px] text-[var(--color-foreground-muted)]">
          {props.instance.appVersion}
        </span>
      </div>
      <button
        type="button"
        aria-label={props.t("remote.actions.copyInstanceId", {
          instanceId: props.instance.id,
        })}
        className="mt-1 block max-w-full truncate rounded font-mono text-xs text-[var(--color-foreground-subtle)] outline-none hover:text-[var(--color-foreground)] hover:underline focus-visible:ring-2 focus-visible:ring-brand-200"
        title={props.t("remote.actions.copyInstanceId", {
          instanceId: props.instance.id,
        })}
        onClick={() => void props.onCopy(props.instance.id)}
      >
        ID: {props.instance.id}
      </button>
      {props.instance.archivedAt ? (
        <div className="mt-1 text-xs text-[var(--color-icon-subtle)]">
          {props.t("remote.archived.archivedAt", {
            archivedAt: formatDateTime(props.locale, props.instance.archivedAt),
          })}
        </div>
      ) : null}
    </div>
  );
}

export function RemoteInstanceStatus(props: {
  instance: RemoteInstance;
  t: RemoteInstanceTranslate;
}): JSX.Element {
  const status = props.instance.archivedAt ? "archived" : props.instance.status;
  const className =
    status === "online"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800"
      : status === "archived"
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800"
        : "bg-[var(--color-surface-muted)] text-[var(--color-foreground-muted)] ring-[var(--color-border)]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {props.t(`remote.status.${status}`)}
    </span>
  );
}

export function RemoteInstanceActions(props: {
  instance: RemoteInstance;
  t: RemoteInstanceTranslate;
  isArchiving: boolean;
  isDeleting: boolean;
  isOpening: boolean;
  isRestoring: boolean;
  onArchive: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onOpen: (instanceId: string) => void;
  onRestore: (instanceId: string) => void;
  onSelectShares: (instanceId: string) => void;
}): JSX.Element {
  const { instance } = props;
  if (instance.archivedAt) {
    return (
      <div
        data-testid="remote-instance-actions"
        className="grid grid-cols-2 gap-1 min-[360px]:flex min-[360px]:flex-wrap md:justify-end"
      >
        <Button
          type="button"
          variant="secondary"
          className="h-8 px-2 text-xs"
          disabled={props.isRestoring}
          onClick={() => props.onRestore(instance.id)}
        >
          {props.t("remote.actions.restore")}
        </Button>
        <Button
          type="button"
          variant="danger"
          className="h-8 px-2 text-xs"
          disabled={props.isDeleting}
          onClick={() => props.onDelete(instance.id)}
        >
          {props.t("remote.actions.delete")}
        </Button>
      </div>
    );
  }

  const isOffline = instance.status !== "online";
  const offlineTitle = isOffline
    ? props.t("remote.actions.offlineHint")
    : undefined;
  return (
    <div
      data-testid="remote-instance-actions"
      className="grid grid-cols-2 gap-1 min-[360px]:flex min-[360px]:flex-wrap md:justify-end"
    >
      <Button
        type="button"
        className="h-8 px-2 text-xs"
        title={offlineTitle}
        disabled={isOffline || props.isOpening}
        onClick={() => props.onOpen(instance.id)}
      >
        {props.t("remote.actions.open")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-2 text-xs"
        onClick={() => props.onSelectShares(instance.id)}
      >
        {props.t("remote.actions.shares")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-8 px-2 text-xs"
        disabled={props.isArchiving}
        onClick={() => props.onArchive(instance.id)}
      >
        {props.t("remote.actions.archive")}
      </Button>
    </div>
  );
}
