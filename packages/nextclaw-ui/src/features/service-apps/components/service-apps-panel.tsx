import { useState, type ReactNode } from "react";
import type {
  ServiceActionGrantView,
  ServiceActionListView,
  ServiceAppRecordView,
} from "@nextclaw/client-sdk";
import { RefreshCw, Server } from "lucide-react";
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
  const [expandedActionsByApp, setExpandedActionsByApp] = useState<
    Record<string, boolean>
  >({});

  const refetch = () => {
    void serviceApps.refetch();
    void serviceActions.refetch();
    void serviceActionGrants.refetch();
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {headerContent ?? (
            <>
              <Server className="h-4 w-4 text-primary" />
              <div className="truncate text-sm font-semibold text-foreground">
                {t("serviceAppsTitle")}
              </div>
            </>
          )}
        </div>
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
                isDiscovering={discoverServiceAppActions.isPending}
                onActionsOpenChange={(open) =>
                  setExpandedActionsByApp((current) => ({
                    ...current,
                    [app.id]: open,
                  }))
                }
                onDiscover={discover}
                onDelete={(appId) => void deleteServiceApp.mutate(appId)}
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
