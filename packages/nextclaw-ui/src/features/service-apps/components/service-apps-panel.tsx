import { useState, type ReactNode } from 'react';
import type {
  ServiceActionGrantView,
  ServiceActionListView,
  ServiceAppRecordView,
} from '@nextclaw/client-sdk';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  LoaderCircle,
  MoreVertical,
  PauseCircle,
  Radar,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Unplug,
  type LucideIcon,
  Wrench,
} from 'lucide-react';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  useDeleteServiceApp,
  useDiscoverServiceAppActions,
  useRestartServiceApp,
  useRevokeServiceActionGrant,
  useServiceActionGrants,
  useServiceActions,
  useServiceApps,
} from '@/features/service-apps/hooks/use-service-apps';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

type ServiceActionView = ServiceActionListView['actions'][number];
type ServiceAppStatus = ServiceAppRecordView['status'];

export function ServiceAppsPanel({
  headerContent,
}: {
  headerContent?: ReactNode;
}) {
  const serviceApps = useServiceApps();
  const serviceActions = useServiceActions();
  const serviceActionGrants = useServiceActionGrants();
  const deleteServiceApp = useDeleteServiceApp();
  const restartServiceApp = useRestartServiceApp();
  const discoverServiceAppActions = useDiscoverServiceAppActions();
  const revokeServiceActionGrant = useRevokeServiceActionGrant();
  const [discoveredActionsByApp, setDiscoveredActionsByApp] = useState<
    Record<string, ServiceActionView[]>
  >({});
  const [expandedActionsByApp, setExpandedActionsByApp] = useState<Record<string, boolean>>({});

  const refetch = () => {
    void serviceApps.refetch();
    void serviceActions.refetch();
    void serviceActionGrants.refetch();
  };

  if (serviceApps.isLoading || serviceActions.isLoading || serviceActionGrants.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
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

  const apps: ServiceAppRecordView[] = serviceApps.data?.entries ?? [];
  const actions: ServiceActionView[] = serviceActions.data?.actions ?? [];
  const grants: ServiceActionGrantView[] = serviceActionGrants.data?.grants ?? [];
  const discover = (appId: string) => {
    void discoverServiceAppActions.mutateAsync(appId).then((result) => {
      setDiscoveredActionsByApp((current) => ({
        ...current,
        [appId]: result.actions,
      }));
      setExpandedActionsByApp((current) => ({
        ...current,
        [appId]: true,
      }));
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {headerContent ?? (
            <>
              <Server className="h-4 w-4 text-primary" />
              <div className="truncate text-sm font-semibold text-foreground">{t('serviceAppsTitle')}</div>
            </>
          )}
        </div>
        <TooltipProvider delayDuration={250}>
          <ServiceAppIconButton
            icon={RefreshCw}
            label={t('serviceAppsRefresh')}
            onClick={refetch}
          />
        </TooltipProvider>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-8 text-center">
          <div className="w-full max-w-xs">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Server className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-foreground">{t('serviceAppsEmptyTitle')}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('serviceAppsEmptyDescription')}</p>
          </div>
        </div>
      ) : (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-muted/25 p-3">
          <div className="space-y-2.5">
            {apps.map((app) => (
              <ServiceAppCard
                key={app.id}
                app={app}
                actions={discoveredActionsByApp[app.id] ?? actions.filter((action) => action.appId === app.id)}
                actionsOpen={Boolean(expandedActionsByApp[app.id])}
                grants={grants}
                deletePending={deleteServiceApp.isPending}
                isDiscovering={discoverServiceAppActions.isPending}
                onActionsOpenChange={(open) => setExpandedActionsByApp((current) => ({
                  ...current,
                  [app.id]: open,
                }))}
                onDiscover={discover}
                onDelete={(appId) => void deleteServiceApp.mutate(appId)}
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
  actionsOpen,
  grants,
  deletePending,
  isDiscovering,
  onActionsOpenChange,
  onDiscover,
  onDelete,
  onRestart,
  onRevoke,
}: {
  app: ServiceAppRecordView;
  actions: ServiceActionView[];
  actionsOpen: boolean;
  grants: ServiceActionGrantView[];
  deletePending: boolean;
  isDiscovering: boolean;
  onActionsOpenChange: (open: boolean) => void;
  onDiscover: (appId: string) => void;
  onDelete: (appId: string) => void;
  onRestart: (appId: string) => void;
  onRevoke: (grant: ServiceActionGrantView) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const canConnectAndDiscover = app.status !== 'starting' && app.status !== 'stopped';
  const canDisconnectRuntime = app.status === 'running' || app.status === 'failed';
  const openDeleteDialog = () => {
    setIsMenuOpen(false);
    setIsDeleteDialogOpen(true);
  };

  return (
    <TooltipProvider delayDuration={250}>
      <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(30,20,10,0.03)]">
        <div className="flex items-start gap-3 px-3 pt-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Server className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-foreground">{app.title}</div>
              <ServiceAppStatusBadge status={app.status} />
            </div>
            {app.description ? (
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{app.description}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <ServiceAppIconButton
              disabled={isDiscovering || !canConnectAndDiscover}
              icon={Radar}
              label={t('serviceAppsDiscoverActions')}
              tooltip={t('serviceAppsDiscoverActionsHint')}
              onClick={() => onDiscover(app.id)}
            />
            <ServiceAppIconButton
              disabled={!canDisconnectRuntime}
              icon={Unplug}
              label={t('serviceAppsDisconnectRuntime')}
              tooltip={t('serviceAppsDisconnectRuntimeHint')}
              onClick={() => onRestart(app.id)}
            />
            <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      aria-label={t('serviceAppsMoreActions')}
                      disabled={deletePending}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{t('serviceAppsMoreActions')}</TooltipContent>
              </Tooltip>
              <PopoverContent align="end" className="w-48 rounded-xl p-1.5">
                <ServiceAppMenuItem
                  destructive
                  disabled={deletePending}
                  icon={Trash2}
                  label={t('serviceAppsDelete')}
                  onClick={openDeleteDialog}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {app.lastError ? (
          <div className="mx-3 mt-3 rounded-lg border border-rose-200/70 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
            {app.lastError}
          </div>
        ) : null}

        <ServiceAppDiagnostics app={app} />

        <div className="mt-3 border-t border-border/50 bg-muted/30">
          <button
            type="button"
            onClick={() => onActionsOpenChange(!actionsOpen)}
            className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
            aria-expanded={actionsOpen}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                  {t('serviceAppsActionsSection')}
                </span>
                <span className="rounded-full bg-card px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground/70">
                  {actions.length}
                </span>
              </div>
              {!actionsOpen ? (
                actions.length === 0 ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t('serviceAppsActionsEmpty')}
                  </div>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {actions.slice(0, 4).map((action) => (
                      <span
                        key={action.id}
                        className="max-w-[9.5rem] truncate rounded-md border border-border/50 bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
                        title={action.title ?? action.name}
                      >
                        {action.title ?? action.name}
                      </span>
                    ))}
                    {actions.length > 4 ? (
                      <span className="rounded-md bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground/70">
                        +{actions.length - 4}
                      </span>
                    ) : null}
                  </div>
                )
              ) : null}
            </div>
            <ChevronDown
              className={cn(
                'mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform',
                actionsOpen && 'rotate-180',
              )}
            />
          </button>
          {actionsOpen ? (
            <div className="px-3 pb-2.5">
              {actions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-card/70 px-2.5 py-2 text-[11px] text-muted-foreground">
                  {t('serviceAppsActionsEmpty')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {actions.map((action) => (
                    <ServiceActionRow
                      key={action.id}
                      action={action}
                      grants={grants.filter((grant) => grant.actionId === action.id)}
                      onRevoke={onRevoke}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <ConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title={t('serviceAppsDeleteConfirmTitle')}
          description={`${t('serviceAppsDeleteConfirmDescription')} ${app.title}`}
          confirmLabel={t('delete')}
          variant="destructive"
          onConfirm={() => onDelete(app.id)}
          onCancel={() => undefined}
        />
      </section>
    </TooltipProvider>
  );
}

function ServiceAppStatusBadge({ status }: { status: ServiceAppStatus }) {
  const view = getServiceAppStatusView(status);
  const Icon = view.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
            view.className,
          )}
          aria-label={view.label}
        >
          <Icon className={cn('h-3 w-3', view.iconClassName)} />
          <span>{view.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{view.tooltip}</TooltipContent>
    </Tooltip>
  );
}

function getServiceAppStatusView(status: ServiceAppStatus): {
  className: string;
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  tooltip: string;
} {
  switch (status) {
    case 'running':
      return {
        className: 'bg-emerald-50 text-emerald-700',
        icon: CheckCircle2,
        label: t('serviceAppsStatus_running'),
        tooltip: t('serviceAppsStatusHint_running'),
      };
    case 'starting':
      return {
        className: 'bg-blue-50 text-blue-700',
        icon: LoaderCircle,
        iconClassName: 'animate-spin',
        label: t('serviceAppsStatus_starting'),
        tooltip: t('serviceAppsStatusHint_starting'),
      };
    case 'failed':
      return {
        className: 'bg-rose-50 text-rose-700',
        icon: AlertTriangle,
        label: t('serviceAppsStatus_failed'),
        tooltip: t('serviceAppsStatusHint_failed'),
      };
    case 'stopped':
      return {
        className: 'bg-muted text-muted-foreground',
        icon: PauseCircle,
        label: t('serviceAppsStatus_stopped'),
        tooltip: t('serviceAppsStatusHint_stopped'),
      };
    case 'idle':
    default:
      return {
        className: 'bg-muted text-muted-foreground',
        icon: CircleDashed,
        label: t('serviceAppsStatus_idle'),
        tooltip: t('serviceAppsStatusHint_idle'),
      };
  }
}

function ServiceAppIconButton({
  disabled = false,
  icon: Icon,
  label,
  tooltip = label,
  onClick,
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:opacity-60 disabled:hover:bg-transparent"
          aria-label={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-56 text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function ServiceAppMenuItem({
  destructive = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  destructive?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        destructive ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function ServiceAppDiagnostics({ app }: { app: ServiceAppRecordView }) {
  const [open, setOpen] = useState(false);
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
    <div className="mx-3 mt-3 overflow-hidden rounded-lg border border-border/50 bg-muted/35">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/50"
        aria-expanded={open}
      >
        <span className="text-[11px] font-medium text-muted-foreground">{t('serviceAppsDetails')}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <dl className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-border/50 px-2.5 py-2 text-[11px]">
          {rows.map((row) => (
            <ServiceAppDiagnosticRow key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>
      ) : null}
    </div>
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
      <dt className="text-muted-foreground/70">{label}</dt>
      <dd className="min-w-0 truncate font-mono text-muted-foreground" title={value}>
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
    <div className="rounded-lg border border-border/50 bg-card px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-foreground">{action.title ?? action.name}</div>
            {action.description ? (
              <div className="truncate text-[11px] text-muted-foreground">{action.description}</div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action.runtimeState ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {t(`serviceAppsRuntimeState_${action.runtimeState}`)}
            </span>
          ) : null}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{action.risk}</span>
        </div>
      </div>
      {grants.map((grant) => (
        <div key={`${grant.caller.surface}:${grant.caller.appId}:${grant.actionId}`} className="mt-1.5 flex items-center justify-between gap-2 pl-8">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
            <span className="truncate">{t('serviceAppsGrantedTo')} {grant.caller.appId}</span>
          </div>
          <button
            type="button"
            onClick={() => onRevoke(grant)}
            className="rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-rose-600"
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
