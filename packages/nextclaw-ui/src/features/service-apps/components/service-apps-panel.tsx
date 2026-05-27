import { useState, type ReactNode } from 'react';
import type {
  ServiceActionGrantView,
  ServiceActionListView,
  ServiceAppRecordView,
} from '@nextclaw/client-sdk';
import {
  RefreshCw,
  RotateCw,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  useDiscoverServiceAppActions,
  useRestartServiceApp,
  useRevokeServiceActionGrant,
  useServiceActionGrants,
  useServiceActions,
  useServiceApps,
} from '@/features/service-apps/hooks/use-service-apps';
import { t } from '@/shared/lib/i18n';

type ServiceActionView = ServiceActionListView['actions'][number];

export function ServiceAppsPanel({
  headerContent,
}: {
  headerContent?: ReactNode;
}) {
  const serviceApps = useServiceApps();
  const serviceActions = useServiceActions();
  const serviceActionGrants = useServiceActionGrants();
  const restartServiceApp = useRestartServiceApp();
  const discoverServiceAppActions = useDiscoverServiceAppActions();
  const revokeServiceActionGrant = useRevokeServiceActionGrant();
  const [discoveredActionsByApp, setDiscoveredActionsByApp] = useState<
    Record<string, ServiceActionView[]>
  >({});

  const refetch = () => {
    void serviceApps.refetch();
    void serviceActions.refetch();
    void serviceActionGrants.refetch();
  };

  if (serviceApps.isLoading || serviceActions.isLoading || serviceActionGrants.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        {t('serviceAppsLoading')}
      </div>
    );
  }

  if (serviceApps.isError || serviceActions.isError || serviceActionGrants.isError) {
    const error = serviceApps.error ?? serviceActions.error ?? serviceActionGrants.error;
    return (
      <div className="p-4 text-sm text-rose-600">
        {error instanceof Error ? error.message : t('serviceAppsLoadFailed')}
      </div>
    );
  }

  const apps = serviceApps.data?.entries ?? [];
  const actions = serviceActions.data?.actions ?? [];
  const grants = serviceActionGrants.data?.grants ?? [];
  const discover = (appId: string) => {
    void discoverServiceAppActions.mutateAsync(appId).then((result) => {
      setDiscoveredActionsByApp((current) => ({
        ...current,
        [appId]: result.actions,
      }));
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {headerContent ?? (
            <>
              <Server className="h-4 w-4 text-primary" />
              <div className="truncate text-sm font-semibold text-gray-900">{t('serviceAppsTitle')}</div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={refetch}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          title={t('serviceAppsRefresh')}
          aria-label={t('serviceAppsRefresh')}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">
          {t('serviceAppsEmpty')}
        </div>
      ) : (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            {apps.map((app) => (
              <ServiceAppCard
                key={app.id}
                app={app}
                actions={discoveredActionsByApp[app.id] ?? actions.filter((action) => action.appId === app.id)}
                grants={grants}
                isDiscovering={discoverServiceAppActions.isPending}
                onDiscover={discover}
                onRestart={(appId) => void restartServiceApp.mutate(appId)}
                onRevoke={(grant) => void revokeServiceActionGrant.mutate({
                  actionId: grant.actionId,
                  caller: grant.caller,
                })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceAppCard({
  app,
  actions,
  grants,
  isDiscovering,
  onDiscover,
  onRestart,
  onRevoke,
}: {
  app: ServiceAppRecordView;
  actions: ServiceActionView[];
  grants: ServiceActionGrantView[];
  isDiscovering: boolean;
  onDiscover: (appId: string) => void;
  onRestart: (appId: string) => void;
  onRevoke: (grant: ServiceActionGrantView) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-gray-900">{app.title}</div>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{app.status}</span>
          </div>
          {app.description ? (
            <div className="mt-1 line-clamp-2 text-xs text-gray-500">{app.description}</div>
          ) : null}
          {app.lastError ? (
            <div className="mt-2 rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">{app.lastError}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onDiscover(app.id)}
            disabled={isDiscovering}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
            title={t('serviceAppsDiscoverActions')}
            aria-label={t('serviceAppsDiscoverActions')}
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRestart(app.id)}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            title={t('serviceAppsRestart')}
            aria-label={t('serviceAppsRestart')}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <ServiceAppDiagnostics app={app} />
      <div className="mt-3 space-y-1">
        {actions.map((action) => (
          <ServiceActionRow
            key={action.id}
            action={action}
            grants={grants.filter((grant) => grant.actionId === action.id)}
            onRevoke={onRevoke}
          />
        ))}
      </div>
    </section>
  );
}

function ServiceAppDiagnostics({ app }: { app: ServiceAppRecordView }) {
  const command = [app.command, ...(app.args ?? [])]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');
  const rows = [
    { label: t('serviceAppsCommand'), value: command },
    { label: t('serviceAppsCwd'), value: app.cwd },
    { label: t('serviceAppsManifest'), value: app.manifestPath },
    { label: t('serviceAppsLastStarted'), value: app.lastStartedAt },
    { label: t('serviceAppsLastReady'), value: app.lastReadyAt },
    { label: t('serviceAppsLastFailed'), value: app.lastFailedAt },
  ].filter((row) => row.value);

  if (rows.length === 0) {
    return null;
  }

  return (
    <dl className="mt-3 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-gray-100 pt-2 text-[11px]">
      {rows.map((row) => (
        <ServiceAppDiagnosticRow key={row.label} label={row.label} value={row.value} />
      ))}
    </dl>
  );
}

function ServiceAppDiagnosticRow({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <>
      <dt className="text-gray-400">{label}</dt>
      <dd className="min-w-0 truncate font-mono text-gray-500" title={value}>
        {value}
      </dd>
    </>
  );
}

function ServiceActionRow({
  action,
  grants,
  onRevoke,
}: {
  action: ServiceActionView;
  grants: ServiceActionGrantView[];
  onRevoke: (grant: ServiceActionGrantView) => void;
}) {
  return (
    <div className="rounded bg-gray-50 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Wrench className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-gray-800">{action.title ?? action.name}</div>
            {action.description ? (
              <div className="truncate text-[11px] text-gray-500">{action.description}</div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action.runtimeState ? (
            <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-gray-600">
              {t(`serviceAppsRuntimeState_${action.runtimeState}`)}
            </span>
          ) : null}
          <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-gray-600">{action.risk}</span>
        </div>
      </div>
      {grants.map((grant) => (
        <div key={`${grant.caller.surface}:${grant.caller.appId}:${grant.actionId}`} className="mt-1 flex items-center justify-between gap-2 pl-5">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
            <span className="truncate">{t('serviceAppsGrantedTo')} {grant.caller.appId}</span>
          </div>
          <button
            type="button"
            onClick={() => onRevoke(grant)}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-white hover:text-rose-600"
            title={t('serviceAppsRevokeGrant')}
            aria-label={t('serviceAppsRevokeGrant')}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
