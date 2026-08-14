import { useState } from "react";
import type {
  ServiceActionGrantView,
  ServiceActionListView,
  AppDataEntry,
  ServiceAppRecordView,
} from "@nextclaw/client-sdk";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  LoaderCircle,
  MoreVertical,
  PauseCircle,
  Radar,
  Server,
  ShieldCheck,
  Trash2,
  Unplug,
  type LucideIcon,
  Wrench,
} from "lucide-react";
import { ServiceAppDeleteDialog } from "@/features/service-apps/components/service-app-delete-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type ServiceActionView = ServiceActionListView["actions"][number];
type ServiceAppStatus = ServiceAppRecordView["status"];

export function ServiceAppListItem({
  app,
  actions,
  actionsOpen,
  grants,
  deletePending,
  deleteError,
  dataEntry,
  dataLoading,
  isDiscovering,
  onActionsOpenChange,
  onDiscover,
  onManagePackage,
  onDelete,
  onResetDelete,
  onRestart,
  onRevoke,
}: {
  app: ServiceAppRecordView;
  actions: ServiceActionView[];
  actionsOpen: boolean;
  grants: ServiceActionGrantView[];
  deletePending: boolean;
  deleteError: unknown;
  dataEntry?: AppDataEntry;
  dataLoading: boolean;
  isDiscovering: boolean;
  onActionsOpenChange: (open: boolean) => void;
  onDiscover: (appId: string) => void;
  onManagePackage: (packageId: string) => void;
  onDelete: (appId: string, purgeData: boolean, onSuccess: () => void) => void;
  onResetDelete: () => void;
  onRestart: (appId: string) => void;
  onRevoke: (grant: ServiceActionGrantView) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [purgeData, setPurgeData] = useState(false);
  const canConnectAndDiscover = app.status !== "starting" && app.status !== "stopped";
  const canDisconnectRuntime = app.status === "running" || app.status === "failed";
  const managedPackageId = app.sourceKind === "package" ? app.packageId : undefined;
  const diagnostics = getServiceAppDiagnostics(app);
  const openDeleteDialog = () => {
    setIsMenuOpen(false);
    setPurgeData(false);
    onResetDelete();
    setIsDeleteDialogOpen(true);
  };
  return (
    <TooltipProvider delayDuration={250}>
      <section className="group bg-card transition-colors hover:bg-muted/25">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Server className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-medium text-foreground">
                {app.title}
              </div>
              <ServiceAppStatusBadge status={app.status} />
            </div>
            {app.description ? (
              <div className="mt-1 truncate text-xs leading-5 text-muted-foreground">
                {app.description}
              </div>
            ) : null}
            {app.lastError ? (
              <div
                className="mt-1.5 truncate text-xs text-rose-600"
                title={app.lastError}
              >
                {app.lastError}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {canConnectAndDiscover ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={isDiscovering}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-xs font-medium text-background transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={t("serviceAppsDiscoverActions")}
                    onClick={() => onDiscover(app.id)}
                  >
                    {isDiscovering ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Radar className="h-3.5 w-3.5" />
                    )}
                    <span>{t("serviceAppsConnect")}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-56 text-xs">
                  {t("serviceAppsDiscoverActionsHint")}
                </TooltipContent>
              </Tooltip>
            ) : null}
            <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:opacity-50"
                      aria-label={t("serviceAppsMoreActions")}
                      disabled={deletePending}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {t("serviceAppsMoreActions")}
                </TooltipContent>
              </Tooltip>
              <PopoverContent align="end" className="w-48 rounded-xl p-1.5">
                <ServiceAppMenuItem
                  disabled={!canDisconnectRuntime}
                  icon={Unplug}
                  label={t("serviceAppsDisconnectRuntime")}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onRestart(app.id);
                  }}
                />
                {managedPackageId ? (
                  <ServiceAppMenuItem
                    icon={Boxes}
                    label={t("serviceAppsManagePackage")}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onManagePackage(managedPackageId);
                    }}
                  />
                ) : (
                  <ServiceAppMenuItem
                    destructive
                    disabled={deletePending}
                    icon={Trash2}
                    label={t("serviceAppsDelete")}
                    onClick={openDeleteDialog}
                  />
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="border-t border-border/60">
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => onActionsOpenChange(!actionsOpen)}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 px-4 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border"
              aria-expanded={actionsOpen}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span>{t("serviceAppsActionsSection")}</span>
                <span className="tabular-nums text-muted-foreground/70">
                  {actions.length}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform",
                  actionsOpen && "rotate-180",
                )}
              />
            </button>
            {diagnostics.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsDiagnosticsOpen((open) => !open)}
                className="flex shrink-0 items-center gap-1 border-l border-border/60 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border"
                aria-expanded={isDiagnosticsOpen}
              >
                <span>{t("serviceAppsDetails")}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    isDiagnosticsOpen && "rotate-180",
                  )}
                />
              </button>
            ) : null}
          </div>
          {actionsOpen ? (
            <div className="border-t border-border/60 px-4 py-2.5">
              {actions.length === 0 ? (
                <div className="py-1 text-xs text-muted-foreground">
                  {t("serviceAppsActionsEmpty")}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {actions.map((action) => (
                    <ServiceActionRow
                      key={action.id}
                      action={action}
                      grants={grants.filter(
                        (grant) => grant.actionId === action.id,
                      )}
                      onRevoke={onRevoke}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {isDiagnosticsOpen ? (
            <ServiceAppDiagnostics rows={diagnostics} />
          ) : null}
        </div>

      {app.sourceKind !== "package" ? (
        <ServiceAppDeleteDialog
          appId={app.id}
          appTitle={app.title}
          dataEntry={dataEntry}
          dataLoading={dataLoading}
          deleteError={deleteError}
          deletePending={deletePending}
          open={isDeleteDialogOpen}
          purgeData={purgeData}
          onDelete={onDelete}
          onOpenChange={setIsDeleteDialogOpen}
          onPurgeDataChange={setPurgeData}
        />
      ) : null}
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
            "inline-flex shrink-0 items-center gap-1 text-xs",
            view.className,
          )}
          aria-label={view.label}
        >
          <Icon className={cn("h-3 w-3", view.iconClassName)} />
          <span>{view.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {view.tooltip}
      </TooltipContent>
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
    case "running":
      return {
        className: "text-emerald-700",
        icon: CheckCircle2,
        label: t("serviceAppsStatus_running"),
        tooltip: t("serviceAppsStatusHint_running"),
      };
    case "starting":
      return {
        className: "text-blue-700",
        icon: LoaderCircle,
        iconClassName: "animate-spin",
        label: t("serviceAppsStatus_starting"),
        tooltip: t("serviceAppsStatusHint_starting"),
      };
    case "failed":
      return {
        className: "text-rose-700",
        icon: AlertTriangle,
        label: t("serviceAppsStatus_failed"),
        tooltip: t("serviceAppsStatusHint_failed"),
      };
    case "stopped":
      return {
        className: "text-muted-foreground",
        icon: PauseCircle,
        label: t("serviceAppsStatus_stopped"),
        tooltip: t("serviceAppsStatusHint_stopped"),
      };
    case "idle":
    default:
      return {
        className: "text-muted-foreground",
        icon: CircleDashed,
        label: t("serviceAppsStatus_idle"),
        tooltip: t("serviceAppsStatusHint_idle"),
      };
  }
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
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-50",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-[var(--interaction-hover)] hover:text-accent-foreground",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function getServiceAppDiagnostics(app: ServiceAppRecordView) {
  const command = [app.command, ...(app.args ?? [])]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  return [
    { label: t("serviceAppsCommand"), value: command },
    { label: t("serviceAppsCwd"), value: app.cwd },
    { label: t("serviceAppsManifest"), value: app.manifestPath },
    { label: t("serviceAppsLastStarted"), value: app.lastStartedAt },
    { label: t("serviceAppsLastReady"), value: app.lastReadyAt },
    { label: t("serviceAppsLastFailed"), value: app.lastFailedAt },
  ].filter((row) => row.value);
}

function ServiceAppDiagnostics({
  rows,
}: {
  rows: Array<{ label: string; value: string | undefined }>;
}) {
  return (
    <div className="border-t border-border/60 px-4 py-2.5">
      <dl className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
        {rows.map((row) => (
          <ServiceAppDiagnosticRow
            key={row.label}
            label={row.label}
            value={row.value}
          />
        ))}
      </dl>
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
      <dd
        className="min-w-0 truncate font-mono text-muted-foreground"
        title={value}
      >
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
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-foreground">
              {action.title ?? action.name}
            </div>
            {action.description ? (
              <div className="truncate text-[11px] text-muted-foreground">
                {action.description}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action.runtimeState ? (
            <span className="text-[11px] text-muted-foreground">
              {t(`serviceAppsRuntimeState_${action.runtimeState}`)}
            </span>
          ) : null}
          <span className="text-[11px] text-muted-foreground">
            {action.risk}
          </span>
        </div>
      </div>
      {grants.map((grant) => (
        <div
          key={`${grant.caller.surface}:${grant.caller.appId}:${grant.actionId}`}
          className="mt-1.5 flex items-center justify-between gap-2 pl-8"
        >
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
            <span className="truncate">
              {t("serviceAppsGrantedTo")} {grant.caller.appId}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRevoke(grant)}
            className="rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-rose-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
            title={t("serviceAppsRevokeGrant")}
            aria-label={t("serviceAppsRevokeGrant")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
