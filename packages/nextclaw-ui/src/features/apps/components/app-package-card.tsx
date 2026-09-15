import { useRef, useState } from "react";
import type { AppDataEntry, AppPackageOperationView, AppPackageView } from "@nextclaw/client-sdk";
import {
  AlertCircle,
  AppWindow,
  Bookmark,
  CalendarDays,
  CheckSquare2,
  ChevronRight,
  MoreVertical,
  Info,
  Power,
  NotebookText,
  RefreshCw,
  RotateCcw,
  Trash2,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { AppArtwork } from "@/features/apps/components/app-artwork";
import { AppPackageDetailsDialog } from "@/features/apps/components/app-package-details-dialog";
import { AppDataRemovalChoice, AppStorageUsageDetails } from "@/features/app-data";
import { isAppPackageOperationActive } from "@/features/apps/hooks/use-app-packages";
import { readAppPackageAvailability } from "@/features/apps/utils/app-package-readiness.utils";
import type { PanelAppEntryView } from "@/shared/lib/api";
import { Button } from "@/shared/components/ui/button";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { Card } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ContextMenu, ContextMenuTrigger } from "@/shared/components/ui/context-menu/context-menu";
import { getLanguage, t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export function AppPackageCard({
  appPackage,
  isPending,
  operation,
  onDisable,
  onEnable,
  onOpenPanelApp,
  onRollback,
  onUninstall,
  onUpdate,
  panelApps,
  storageUsage,
  storageUsageLoading,
  storageUsageUnavailable,
  unavailableMessage,
}: {
  appPackage: AppPackageView;
  isPending: boolean;
  operation?: AppPackageOperationView;
  onDisable: () => void;
  onEnable: () => void;
  onOpenPanelApp: (entry: PanelAppEntryView) => void;
  onRollback: (version: string) => void;
  onUninstall: (purgeData: boolean) => void;
  onUpdate: () => void;
  panelApps: PanelAppEntryView[];
  storageUsage?: AppDataEntry["usage"];
  storageUsageLoading: boolean;
  storageUsageUnavailable: boolean;
  unavailableMessage?: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsTriggerRef = useRef<HTMLButtonElement>(null);
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [purgeData, setPurgeData] = useState(false);
  const uninstallCancelRef = useRef<HTMLButtonElement>(null);
  const panelComponents = appPackage.components.filter((component) => component.kind === "panel");
  const rollbackVersions = appPackage.installedVersions.filter((version) => version !== appPackage.activeVersion);
  const displayName = readLocalizedText(appPackage.name, appPackage.nameI18n) ?? appPackage.id;
  const displayDescription = readLocalizedText(appPackage.description, appPackage.descriptionI18n);
  const operationActive = operation ? isAppPackageOperationActive(operation.status) : false;
  const pending = isPending || operationActive;
  const availability = readAppPackageAvailability(appPackage, unavailableMessage);
  const singlePanel =
    panelComponents.length === 1 ? panelApps.find((entry) => entry.appId === panelComponents[0].id) : undefined;
  const primaryAction = !appPackage.enabled ? "enable" : panelComponents.length === 1 ? "open" : "details";
  const primaryDisabled =
    pending || (primaryAction !== "details" && !availability.interactive) || (primaryAction === "open" && !singlePanel);
  const primaryLabel = { enable: "appPackagesEnable", open: "appPackagesOpen", details: "appPackagesDetails" } as const;

  return (
    <Card
      surface="flat"
      hover={false}
      className="[container-type:inline-size] overflow-hidden rounded-none border-0 shadow-none"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-4">
        <AppArtwork icon={appPackage.icon} name={displayName} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="min-w-0 max-w-full text-sm font-semibold text-foreground">
              <button
                ref={detailsTriggerRef}
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="block max-w-full truncate rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                title={displayName}
              >
                {displayName}
              </button>
            </h2>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", availability.className)}>
              {availability.label}
            </span>
          </div>
          {availability.message ? (
            <p role="alert" className={cn("mt-2 text-xs leading-5", availability.messageClassName)}>
              {availability.message}
            </p>
          ) : null}
          {!appPackage.enabled && appPackage.readiness.status !== "ready" ? (
            <ul className="mt-1.5 space-y-1 text-xs leading-5 text-muted-foreground">
              {appPackage.readiness.requirements.map((requirement) => (
                <li key={`${requirement.componentId}:${requirement.kind}:${requirement.id}`}>
                  {requirement.title}
                  {requirement.description ? ` — ${requirement.description}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {displayDescription ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{displayDescription}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={primaryDisabled}
            title={availability.message}
            onClick={() => {
              if (!appPackage.enabled) onEnable();
              else if (singlePanel) onOpenPanelApp(singlePanel);
              else setDetailsOpen(true);
            }}
          >
            {pending
              ? renderPrimaryActionLabel({ enabled: appPackage.enabled, isPending, operation, operationActive })
              : t(primaryLabel[primaryAction])}
          </Button>
          <ContextMenu
            label={t("appPackagesMoreActions")}
            groups={
              pending
                ? []
                : [
                    {
                      key: "manage",
                      items: [
                        {
                          key: "details",
                          icon: <Info className="h-4 w-4" />,
                          label: t("appPackagesDetails"),
                          restoreFocus: false,
                          onSelect: () => setDetailsOpen(true),
                        },
                        ...(appPackage.enabled
                          ? [
                              {
                                key: "disable",
                                icon: <Power className="h-4 w-4" />,
                                label: t("appPackagesDisable"),
                                onSelect: onDisable,
                              },
                            ]
                          : []),
                        {
                          key: "update",
                          icon: <RefreshCw className="h-4 w-4" />,
                          label: t("appPackagesCheckUpdate"),
                          onSelect: onUpdate,
                        },
                        ...rollbackVersions.map((version) => ({
                          key: version,
                          icon: <RotateCcw className="h-4 w-4" />,
                          label: `${t("appPackagesRollback")} v${version}`,
                          onSelect: () => onRollback(version),
                        })),
                      ],
                    },
                    {
                      key: "remove",
                      items: [
                        {
                          key: "uninstall",
                          destructive: true,
                          icon: <Trash2 className="h-4 w-4" />,
                          label: t("appPackagesUninstall"),
                          restoreFocus: false,
                          onSelect: () => {
                            setPurgeData(false);
                            setUninstallOpen(true);
                          },
                        },
                      ],
                    },
                  ]
            }
          >
            <div>
              <ContextMenuTrigger>
                <IconActionButton
                  icon={<MoreVertical className="h-4 w-4" />}
                  label={t("appPackagesMoreActions")}
                  disabled={pending}
                />
              </ContextMenuTrigger>
            </div>
          </ContextMenu>
        </div>
      </div>

      <AppPackageDetailsDialog
        appPackage={appPackage}
        disabled={pending || Boolean(unavailableMessage)}
        displayName={displayName}
        displayDescription={displayDescription}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onFocusReturn={() => detailsTriggerRef.current?.focus()}
        storageUsage={storageUsage}
        storageUsageLoading={storageUsageLoading}
        storageUsageUnavailable={storageUsageUnavailable}
      />

      {operation && (operationActive || operation.status === "failed" || operation.status === "interrupted") ? (
        <PackageOperationStatus operation={operation} />
      ) : null}

      {appPackage.enabled && panelComponents.length > 1 ? (
        <div className="px-3 pb-3 [@container(min-width:28rem)]:pl-16">
          <div className="grid grid-cols-1 gap-1 [@container(min-width:20rem)]:grid-cols-2">
            {panelComponents.map((component) => {
              const panelApp = panelApps.find((entry) => entry.appId === component.id);
              const Icon = resolveComponentIcon(component.id);
              const componentTitle = readLocalizedText(component.title, component.titleI18n) ?? component.id;
              return (
                <button
                  key={component.id}
                  type="button"
                  disabled={!panelApp || pending || !availability.interactive}
                  onClick={() =>
                    panelApp &&
                    onOpenPanelApp({
                      ...panelApp,
                      title: componentTitle,
                      description: readLocalizedText(component.description, component.descriptionI18n),
                    })
                  }
                  className="group flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-default disabled:opacity-55"
                  title={availability.message ?? componentTitle}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground">
                    <ComponentIcon icon={component.icon} fallback={Icon} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{componentTitle}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <Dialog open={uninstallOpen} onOpenChange={setUninstallOpen}>
        <DialogContent
          className="max-w-md"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            detailsTriggerRef.current?.focus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            uninstallCancelRef.current?.focus();
          }}
        >
          <DialogHeader showClose={false}>
            <DialogTitle>{t("appPackagesUninstallTitle")}</DialogTitle>
            <DialogDescription>{t("appPackagesUninstallDescription")}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-2">
            <AppDataRemovalChoice
              checked={!purgeData}
              description={t("appPackagesKeepDataDescription")}
              label={t("appPackagesKeepData")}
              onClick={() => setPurgeData(false)}
            />
            <AppDataRemovalChoice
              checked={purgeData}
              destructive
              description={t("appPackagesDeleteDataDescription")}
              label={t("appPackagesDeleteData")}
              onClick={() => setPurgeData(true)}
            />
          </div>
          <div className="mt-3">
            <AppPackageStorageUsage
              loading={storageUsageLoading}
              storage={appPackage.storage}
              usage={storageUsage}
              unavailable={storageUsageUnavailable}
            />
          </div>
          <DialogFooter className="mt-5 gap-2 sm:gap-0">
            <Button
              ref={uninstallCancelRef}
              autoFocus
              type="button"
              variant="outline"
              onClick={() => setUninstallOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onUninstall(purgeData);
                setUninstallOpen(false);
              }}
            >
              {t("appPackagesUninstall")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AppPackageStorageUsage({
  loading,
  storage,
  unavailable,
  usage,
}: {
  loading: boolean;
  storage: AppPackageView["storage"];
  unavailable: boolean;
  usage?: AppDataEntry["usage"];
}) {
  if (usage) {
    return <AppStorageUsageDetails storage={storage} usage={usage} />;
  }
  return (
    <div className="rounded-xl bg-muted/45 px-3 py-3 text-xs text-muted-foreground">
      {loading ? <LoaderCircle className="mr-1.5 inline h-3.5 w-3.5 animate-spin" /> : null}
      {t(loading ? "appPackagesLoading" : unavailable ? "appPackagesDataUsageUnavailable" : "appPackagesNoDataYet")}
    </div>
  );
}

function renderPrimaryActionLabel({
  enabled,
  isPending,
  operation,
  operationActive,
}: {
  enabled: boolean;
  isPending: boolean;
  operation?: AppPackageOperationView;
  operationActive: boolean;
}) {
  if (operationActive) {
    return (
      <>
        <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        {operation ? operationLabel(operation) : t("appPackagesWorking")}
      </>
    );
  }
  if (isPending) return t("appPackagesWorking");
  return enabled ? t("appPackagesDisable") : t("appPackagesEnable");
}

function ComponentIcon({ fallback: Fallback, icon }: { fallback: LucideIcon; icon?: string }) {
  if (
    icon &&
    (icon.startsWith("data:") || icon.startsWith("/") || icon.startsWith("http://") || icon.startsWith("https://"))
  ) {
    return <img src={icon} alt="" className="h-4 w-4 rounded object-cover" />;
  }
  if (icon) {
    return <span className="text-sm leading-none">{icon}</span>;
  }
  return <Fallback className="h-3.5 w-3.5" />;
}

function PackageOperationStatus({ operation }: { operation: AppPackageOperationView }) {
  const failed = operation.status === "failed" || operation.status === "interrupted";
  const progress = Math.max(4, Math.round((operation.completedSteps / operation.totalSteps) * 100));
  return (
    <div className="border-t border-border/50 px-4 py-2.5" role={failed ? "alert" : "status"} aria-live="polite">
      <div className="flex items-center gap-2 text-[11px]">
        {failed ? (
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
        )}
        <span className={failed ? "text-destructive" : "text-muted-foreground"}>
          {failed ? (operation.error ?? t("appPackagesActionFailed")) : operationLabel(operation)}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            failed ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: failed ? "100%" : `${progress}%` }}
        />
      </div>
    </div>
  );
}

function operationLabel(operation: AppPackageOperationView): string {
  switch (operation.status) {
    case "queued":
      return t("appPackagesPreparing");
    case "resolving":
      return t("appPackagesResolving");
    case "downloading":
      return t("appPackagesDownloading");
    case "verifying":
      return t("appPackagesVerifying");
    case "installing":
      return operation.action === "rollback"
        ? `${t("appPackagesSwitchingVersion")} ${operation.targetVersion ? `v${operation.targetVersion}` : ""}`.trim()
        : operation.action === "uninstall"
          ? t("appPackagesUninstalling")
          : t("appPackagesInstalling");
    case "finalizing":
      return t("appPackagesFinalizing");
    case "succeeded":
      return t("appPackagesCompleted");
    case "failed":
    case "interrupted":
      return t("appPackagesActionFailed");
  }
}

function resolveComponentIcon(componentId: string): LucideIcon {
  if (componentId.endsWith("-todos")) return CheckSquare2;
  if (componentId.endsWith("-notes")) return NotebookText;
  if (componentId.endsWith("-favorites")) return Bookmark;
  if (componentId.endsWith("-calendar")) return CalendarDays;
  return AppWindow;
}

function readLocalizedText(
  fallback: string | undefined,
  localized: Record<string, string> | undefined,
): string | undefined {
  const languageTag = getLanguage() === "zh" ? "zh-CN" : "en-US";
  return localized?.[languageTag] ?? fallback;
}
