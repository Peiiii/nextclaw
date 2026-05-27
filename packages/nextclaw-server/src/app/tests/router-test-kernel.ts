import { EventBus, Ingress } from "@nextclaw/shared";
import type { UiKernelHost } from "@nextclaw-server/app/types/router-options.types.js";

function unavailable(name: string): never {
  throw new Error(`test kernel ${name} is not configured`);
}

export function createRouterTestKernel(overrides: Partial<UiKernelHost> = {}): UiKernelHost {
  return {
    listSessionTypes: async () => ({
      defaultType: "native",
      options: [{ value: "native", label: "Native" }],
    }),
    isSessionRunning: () => false,
    assetStore: {
      putBytes: async () => unavailable("assetStore.putBytes"),
      statRecord: async () => null,
      resolveContentPath: () => null,
    } as never,
    eventBus: new EventBus(),
    ingress: new Ingress(),
    llmProviders: {} as never,
    ncpSessionManager: {
      listSessions: async () => [],
      listSessionMessages: async () => [],
      getSession: async () => null,
      getSessionRecord: async () => null,
      updateSession: async () => null,
      setSessionMetadata: async () => false,
      updateSessionMetadata: async () => false,
      deleteSession: async () => undefined,
      getContextWindow: async () => null,
    } as never,
    panelAppManager: {
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () =>
        unavailable("panelAppManager.getPanelAppContent"),
      updatePanelAppPreferences: async () =>
        unavailable("panelAppManager.updatePanelAppPreferences"),
      recordPanelAppOpened: async () =>
        unavailable("panelAppManager.recordPanelAppOpened"),
    } as never,
    serviceAppManager: {
      listServiceApps: async () => ({
        workspacePath: "",
        serviceAppsPath: "",
        entries: [],
      }),
      getServiceApp: async () =>
        unavailable("serviceAppManager.getServiceApp"),
      listServiceActions: async () => [],
      discoverServiceAppActions: async () =>
        unavailable("serviceAppManager.discoverServiceAppActions"),
      invokeServiceAction: async () =>
        unavailable("serviceAppManager.invokeServiceAction"),
      grantServiceAction: async () =>
        unavailable("serviceAppManager.grantServiceAction"),
      listServiceActionGrants: async () => [],
      revokeServiceAction: async () =>
        unavailable("serviceAppManager.revokeServiceAction"),
      restartServiceApp: async () =>
        unavailable("serviceAppManager.restartServiceApp"),
    } as never,
    ...overrides,
  };
}
