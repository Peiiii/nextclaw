import { useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePanelAppClientGrant } from "@/features/panel-apps/hooks/use-panel-app-client-grant";
import {
  PANEL_APPS_QUERY_KEY,
  replacePanelAppListEntry,
} from "@/features/panel-apps/hooks/use-panel-apps";
import {
  nextclawClient,
  type PanelAppEntryView,
  type PanelAppListView,
} from "@/shared/lib/api";

export type PanelAppMainRuntimeState = "allowed" | "checking" | "denied" | "error" | "idle";

export function usePanelAppMainRuntime(entry: PanelAppEntryView | undefined) {
  const queryClient = useQueryClient();
  const runtimeInstanceId = useId();
  const { ensurePanelAppClientGrant } = usePanelAppClientGrant();
  const requiresClientGrant = Boolean(
    entry?.clientDeclared && !entry.clientGranted,
  );
  const grantQuery = useQuery({
    queryKey: [
      "panel-app-main-client-grant",
      entry?.appId ?? "none",
      entry?.clientGranted ?? false,
    ],
    queryFn: async () => await ensurePanelAppClientGrant(entry!),
    enabled: requiresClientGrant,
    gcTime: 0,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const state: PanelAppMainRuntimeState = !entry
    ? "idle"
    : !requiresClientGrant
      ? "allowed"
      : grantQuery.isError
        ? "error"
        : grantQuery.isPending
          ? "checking"
          : grantQuery.data
            ? "allowed"
            : "denied";

  useQuery({
    queryKey: ["panel-app-main-open", runtimeInstanceId, entry?.appId ?? "none"],
    queryFn: async () => {
      const opened = await nextclawClient.panelApps.recordPanelAppOpened(entry!.id);
      queryClient.setQueryData<PanelAppListView>(
        PANEL_APPS_QUERY_KEY,
        (current) => replacePanelAppListEntry(current, opened),
      );
      return opened;
    },
    enabled: Boolean(entry && state === "allowed"),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return {
    retryClientGrant: grantQuery.refetch,
    state,
  };
}
