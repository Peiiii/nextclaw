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
    observations: {} as never,
    extensions: {
      getDesktopHost: () => ({
        status: async () => unavailable("extensions.desktopHost.status"),
        grantAccess: async () => unavailable("extensions.desktopHost.grantAccess"),
        getPermissions: async () => unavailable("extensions.desktopHost.getPermissions"),
        requestPermissions: async () => unavailable("extensions.desktopHost.requestPermissions"),
        openPermissionSettings: async () => unavailable("extensions.desktopHost.openPermissionSettings"),
      }),
    } as never,
    capabilityGrants: {
      list: async () => [],
      grant: async () => unavailable("capabilityGrants.grant"),
      revoke: async () => unavailable("capabilityGrants.revoke"),
    } as never,
    featureControls: {
      get: async () => ({ desktopAutomation: { available: false } }),
    } as never,
    inboxDeliveryManager: {
      listDeliveries: async () => ({
        deliveries: [],
        total: 0,
        unreadCount: 0,
        unpresentedCount: 0,
      }),
      getDelivery: async () => null,
      updateDeliveryState: async () =>
        unavailable("inboxDeliveryManager.updateDeliveryState"),
      deleteDelivery: async () => false,
    } as never,
    systemObjectReferenceManager: {
      listReferences: async () => ({ groups: [], total: 0 }),
      resolveReference: async () => unavailable("systemObjectReferenceManager.resolveReference"),
    } as never,
    agentRunRequestManager: {
      listQueuedInputs: () => [],
      removeQueuedInput: () => null,
    } as never,
    agentContextWindowManager: {
      assertCanSave: async (params: { agentId: string; contextTokens: number }) => ({
        agentId: params.agentId,
        contextTokens: params.contextTokens,
        fixedInputTokens: 0,
        minimumContextTokens: 1_000,
        reservedContextTokens: Math.floor(params.contextTokens * 0.2),
      }),
      assertDefaultCanSave: async () => [],
    } as never,
    appPackageManager: {
      listPackages: async () => ({ entries: [] }),
      getPackage: async () => unavailable("appPackageManager.getPackage"),
      install: async () => unavailable("appPackageManager.install"),
      enable: async () => unavailable("appPackageManager.enable"),
      disable: async () => unavailable("appPackageManager.disable"),
      update: async () => unavailable("appPackageManager.update"),
      rollback: async () => unavailable("appPackageManager.rollback"),
      uninstall: async () => unavailable("appPackageManager.uninstall"),
    } as never,
    appDataManager: {
      list: async () => ({ entries: [], diagnostics: [] }),
      deleteRetained: async () => unavailable("appDataManager.deleteRetained"),
    } as never,
    llmProviders: {} as never,
    providerModelCatalog: {
      getSnapshot: () => ({
        refreshIntervalMs: 43_200_000,
        refreshing: false,
        lastRefreshStartedAt: null,
        lastRefreshCompletedAt: null,
        providers: {},
      }),
    } as never,
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
    sessionRunManager: {
      deleteSessionRun: () => false,
    } as never,
    sessionContextCompactionManager: {
      compact: async () => unavailable("sessionContextCompactionManager.compact"),
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
      invokeInstalledServiceAction: async () =>
        unavailable("serviceAppManager.invokeInstalledServiceAction"),
      listVerificationRecords: async () => ({ entries: [] }),
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
    portableRuntimeAcceptance: {
      contract: () => ({
        contractFingerprint: "sha256:test",
        locale: "zh-CN",
        definitions: [{ id: "test.registry-projection" }],
      }),
      status: async () => ({
        schemaVersion: 1,
        contract: { contractFingerprint: "sha256:test", locale: "zh-CN", definitions: [{ id: "test.registry-projection" }] },
        appId: "test",
        identity: { available: false, reason: "test", environment: null, productVersion: null, runtimeVersion: null, runtimeVersionSource: null },
        entries: [{ id: "test.registry-projection", result: { status: "missing" } }],
        summary: { "current-passed": 0, missing: 1, stale: 0, failed: 0, "not-applicable": 0 },
      }),
      export: async () => ({
        schemaVersion: 1,
        contract: { contractFingerprint: "sha256:test", locale: "zh-CN", definitions: [{ id: "test.registry-projection" }] },
        appId: "test",
        identity: { available: false, reason: "test", environment: null, productVersion: null, runtimeVersion: null, runtimeVersionSource: null },
        entries: [{ id: "test.registry-projection", result: { status: "missing" } }],
        summary: { "current-passed": 0, missing: 1, stale: 0, failed: 0, "not-applicable": 0 },
      }),
    } as never,
    ...overrides,
  };
}
