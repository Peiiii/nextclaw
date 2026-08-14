import { useState } from "react";
import type {
  ServiceActionGrantView,
  ServiceActionListView,
  AppDataEntry,
  ServiceAppRecordView,
} from "@nextclaw/client-sdk";
import { RefreshCw, Server } from "lucide-react";
import { useAppData } from "@/features/app-data";
import { ServiceAppListItem } from "@/features/service-apps/components/service-app-list-item";
import {
  useDeleteServiceApp,
  useDiscoverServiceAppActions,
  useRestartServiceApp,
  useRevokeServiceActionGrant,
  useServiceActionGrants,
  useServiceActions,
  useServiceApps,
} from "@/features/service-apps/hooks/use-service-apps";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { t } from "@/shared/lib/i18n";

type ServiceActionView = ServiceActionListView["actions"][number];

export function ServiceAppsPanel({
  onManagePackage,
}: {
  onManagePackage: (packageId: string) => void;
}) {
  const serviceApps = useServiceApps();
  const appData = useAppData();
  const serviceActions = useServiceActions();
  const serviceActionGrants = useServiceActionGrants();
  const deleteServiceApp = useDeleteServiceApp();
  const restartServiceApp = useRestartServiceApp();
  const discoverServiceAppActions = useDiscoverServiceAppActions();
  const revokeServiceActionGrant = useRevokeServiceActionGrant();
  const [discoveredActionsByApp, setDiscoveredActionsByApp] = useState<
    Record<string, ServiceActionView[]>
  >({});
  const [expandedActionsByApp, setExpandedActionsByApp] = useState<
    Record<string, boolean>
  >({});

  const refetch = () => {
    void serviceApps.refetch();
    void serviceActions.refetch();
    void serviceActionGrants.refetch();
    void appData.refetch();
  };

  if (
    serviceApps.isLoading ||
    serviceActions.isLoading ||
    serviceActionGrants.isLoading
  ) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("serviceAppsLoading")}
      </div>
    );
  }

  if (
    serviceApps.isError ||
    serviceActions.isError ||
    serviceActionGrants.isError
  ) {
    const error =
      serviceApps.error ?? serviceActions.error ?? serviceActionGrants.error;
    return (
      <div className="p-4 text-sm text-rose-600">
        {error instanceof Error ? error.message : t("serviceAppsLoadFailed")}
      </div>
    );
  }

  const apps: ServiceAppRecordView[] = serviceApps.data?.entries ?? [];
  const diagnostics = serviceApps.data?.diagnostics ?? [];
  const actions: ServiceActionView[] = serviceActions.data?.actions ?? [];
  const grants: ServiceActionGrantView[] =
    serviceActionGrants.data?.grants ?? [];
  const discover = (appId: string) => {
    void discoverServiceAppActions.mutateAsync(appId).then((result) => {
      setDiscoveredActionsByApp((current) => ({
        ...current,
        [appId]: result.actions,
      }));
      setExpandedActionsByApp((current) => ({ ...current, [appId]: true }));
    });
  };
  const workspaceDataEntries = (appData.data?.entries ?? [])
    .filter((entry): entry is AppDataEntry =>
      entry.source === "workspace-service" && entry.lifecycle === "active");

  return (
    <div className="flex h-full min-h-0 flex-col bg-card text-card-foreground">
      <div className="flex min-h-12 shrink-0 items-center justify-end border-b border-border/60 px-4 py-2">
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                aria-label={t("serviceAppsRefresh")}
                onClick={refetch}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t("serviceAppsRefresh")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {diagnostics.length > 0 ? (
        <div
          role="alert"
          className="mx-3 mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive sm:mx-4"
        >
          <div className="font-medium">{t("serviceAppsLoadFailed")}</div>
          <ul className="mt-1 space-y-1">
            {diagnostics.map((diagnostic) => (
              <li key={diagnostic.stagedPath} className="break-words">
                {diagnostic.appId}: {diagnostic.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {apps.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-8 text-center">
          <div className="w-full max-w-xs">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Server className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-foreground">
              {t("serviceAppsEmptyTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("serviceAppsEmptyDescription")}
            </p>
          </div>
        </div>
      ) : (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            {apps.map((app) => (
              <ServiceAppListItem
                key={app.id}
                app={app}
                actions={
                  discoveredActionsByApp[app.id] ??
                  actions.filter((action) => action.appId === app.id)
                }
                actionsOpen={Boolean(expandedActionsByApp[app.id])}
                grants={grants}
                deletePending={deleteServiceApp.isPending}
                deleteError={deleteServiceApp.error}
                dataEntry={workspaceDataEntries.find((entry) => entry.appId === app.id)}
                dataLoading={appData.isLoading}
                isDiscovering={discoverServiceAppActions.isPending}
                onActionsOpenChange={(open) =>
                  setExpandedActionsByApp((current) => ({
                    ...current,
                    [app.id]: open,
                  }))
                }
                onDiscover={discover}
                onManagePackage={onManagePackage}
                onDelete={(appId, purgeData, onSuccess) => void deleteServiceApp.mutate(
                  { appId, purgeData },
                  { onSuccess },
                )}
                onResetDelete={deleteServiceApp.reset}
                onRestart={(appId) => void restartServiceApp.mutate(appId)}
                onRevoke={(grant) =>
                  void revokeServiceActionGrant.mutate({
                    actionId: grant.actionId,
                    caller: grant.caller,
                  })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
