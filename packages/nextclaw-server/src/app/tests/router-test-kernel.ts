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
    sessionManager: {
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
      getPanelAppAsset: async () =>
        unavailable("panelAppManager.getPanelAppAsset"),
      getPanelAppAssetByToken: async () =>
        unavailable("panelAppManager.getPanelAppAssetByToken"),
      createPanelAppBridgeSession: async () =>
        unavailable("panelAppManager.createPanelAppBridgeSession"),
      deletePanelAppBridgeSession: () =>
        unavailable("panelAppManager.deletePanelAppBridgeSession"),
      sendAgentMessage: async () =>
        unavailable("panelAppManager.sendAgentMessage"),
      generateAgentObject: async () =>
        unavailable("panelAppManager.generateAgentObject"),
      grantAgentCapability: async () =>
        unavailable("panelAppManager.grantAgentCapability"),
      updatePanelAppPreferences: async () =>
        unavailable("panelAppManager.updatePanelAppPreferences"),
      recordPanelAppOpened: async () =>
        unavailable("panelAppManager.recordPanelAppOpened"),
    } as never,
    preferenceManager: {
      getPreference: async () => null,
      setPreference: async () =>
        unavailable("preferenceManager.setPreference"),
      deletePreference: async () => false,
    } as never,
    projectManager: {
      listProjects: async () => [],
      listTemplates: () => [],
      createProject: async () => unavailable("projectManager.createProject"),
      resolveExistingProjectRoot: async () => null,
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
      grantServiceActions: async () =>
        unavailable("serviceAppManager.grantServiceActions"),
      listServiceActionGrants: async () => [],
      revokeServiceAction: async () =>
        unavailable("serviceAppManager.revokeServiceAction"),
      restartServiceApp: async () =>
        unavailable("serviceAppManager.restartServiceApp"),
      deleteServiceApp: async () =>
        unavailable("serviceAppManager.deleteServiceApp"),
    } as never,
    ...overrides,
  };
}
