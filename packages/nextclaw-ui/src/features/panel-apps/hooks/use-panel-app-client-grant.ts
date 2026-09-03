import { useCallback, useRef } from "react";
import { usePanelAppHostPresenter } from "@/features/panel-apps/providers/panel-app-host.provider";
import { useGrantPanelAppClient } from "@/features/panel-apps/hooks/use-panel-apps";
import type { PanelAppEntryView } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";

export function usePanelAppClientGrant() {
  const presenter = usePanelAppHostPresenter();
  const { isPending, mutateAsync: grantPanelAppClient } = useGrantPanelAppClient();
  const pendingGrantsRef = useRef(new Map<string, Promise<boolean>>());

  const ensurePanelAppClientGrant = useCallback(async (
    entry: PanelAppEntryView,
  ): Promise<boolean> => {
    if (!entry.clientDeclared || entry.clientGranted) {
      return true;
    }
    const pendingGrant = pendingGrantsRef.current.get(entry.appId);
    if (pendingGrant) {
      return await pendingGrant;
    }
    const grant = (async () => {
      const allowed = await presenter.serviceActionAuthorizationManager.requestAuthorization({
        panelAppId: entry.appId,
        actions: [{
          actionId: "nextclaw.client",
          actionTitle: t("panelAppsClientGrantTitle"),
          actionDescription: t("panelAppsClientGrantDescription"),
          risk: "dangerous",
        }],
      });
      if (!allowed) {
        return false;
      }
      await grantPanelAppClient(entry.appId);
      return true;
    })();
    pendingGrantsRef.current.set(entry.appId, grant);
    try {
      return await grant;
    } finally {
      pendingGrantsRef.current.delete(entry.appId);
    }
  }, [grantPanelAppClient, presenter]);

  return {
    ensurePanelAppClientGrant,
    isPending,
  };
}
