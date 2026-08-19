import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_PANELS_DIR, getWorkspacePathFromConfig } from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { PanelAppPackageStateManager } from "@kernel/managers/panel-app-package-state.manager.js";
import { PanelAppEntryPresenter } from "@kernel/presenters/panel-app-entry.presenter.js";
import { PanelAppAssetTokenService } from "@kernel/services/panel-app-asset-token.service.js";
import { PanelAppStateStore } from "@kernel/stores/panel-app-state.store.js";
import type { PanelAppPreferencesUpdate } from "@kernel/stores/panel-app-state.store.js";
import { PanelAppCapabilityGrantStore } from "@kernel/stores/panel-app-capability-grant.store.js";
import { PanelAppClientGrantStore } from "@kernel/stores/panel-app-client-grant.store.js";
import type { PanelAppClientGrant } from "@kernel/stores/panel-app-client-grant.store.js";
import type { AppPackageComponentSource } from "@kernel/types/app-package.types.js";
import type {
  PanelAppAgentCapability,
  PanelAppAgentGenerateObjectInput,
  PanelAppAgentGenerateObjectResult,
  PanelAppAgentRunClient,
  PanelAppAgentSendPayload,
  PanelAppAgentSendResult,
  PanelAppCapabilityGrant,
  PanelAppBridgeSession,
  PanelAppContent,
  PanelAppDeleteResult,
  PanelAppEntry,
  PanelAppList,
} from "@kernel/types/panel-app.types.js";
import {
  isPanelAppError,
  PanelAppError,
} from "@kernel/types/panel-app.types.js";
import { AgentRunClient } from "@kernel/services/agent-run-client.service.js";
import { PanelAppAgentBridgeService } from "@kernel/services/panel-app-agent-bridge.service.js";
import {
  getPanelAppBridgeScript,
  injectPanelAppBridgeScript,
} from "@kernel/utils/panel-app-bridge.utils.js";
import { injectPanelAppClientScript } from "@kernel/utils/panel-app-client-injection.utils.js";
import { parsePanelAppManifest } from "@kernel/utils/panel-app-manifest.utils.js";
import {
  encodePanelAppId,
  type PanelAppAsset,
  type PanelAppSource,
} from "@kernel/utils/panel-app-source.utils.js";
import { PanelAppSourceService } from "@kernel/services/panel-app-source.service.js";
import {
  readPanelAppContentSourceByIdOrPath,
  resolvePanelAppAppId,
} from "@kernel/utils/panel-app-content-source.utils.js";
import type {
  EventBus,
  Ingress,
} from "@nextclaw/shared";

export type { PanelAppPreferencesUpdate } from "@kernel/stores/panel-app-state.store.js";

const PANEL_APP_CONTENT_BASE_PATH = "/api/panel-apps";
const PANEL_APP_TOKENIZED_ASSET_BASE_PATH = "/api/panel-app-assets";
const PANEL_APP_CONTENT_TYPE = "text/html; charset=utf-8" as const;
const PANEL_APP_CAPABILITY_GRANTS_FILE_NAME = ".panel-app-capability-grants.json";
const PANEL_APP_CLIENT_GRANTS_FILE_NAME = ".panel-app-client-grants.json";
const PANEL_APP_RUNTIME_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export class PanelAppManager {
  private readonly bridgeSessions = new Map<string, PanelAppBridgeSession>();
  private readonly agentRunClient: PanelAppAgentRunClient | null;
  private readonly agentBridgeService: PanelAppAgentBridgeService;
  private readonly assetTokenService = new PanelAppAssetTokenService();
  private readonly sourceService = new PanelAppSourceService();
  private readonly packageStateManager: PanelAppPackageStateManager;
  private readonly entryPresenter: PanelAppEntryPresenter;

  constructor(private readonly params: {
    agentRunClient?: PanelAppAgentRunClient;
    configManager: ConfigManager;
    eventBus?: EventBus;
    ingress?: Ingress;
    listPackageComponentSources?: () => Promise<AppPackageComponentSource[]>;
  }) {
    this.agentRunClient = params.agentRunClient ??
      (params.eventBus && params.ingress
        ? new AgentRunClient({ eventBus: params.eventBus, ingress: params.ingress })
        : null);
    this.agentBridgeService = new PanelAppAgentBridgeService({
      agentRunClient: this.agentRunClient,
      createCapabilityGrantStore: this.createCapabilityGrantStore,
    });
    this.packageStateManager = new PanelAppPackageStateManager({
      sourceService: this.sourceService,
      getPanelsPath: () => this.getPanelsPath(this.getWorkspacePath()),
      listPackageComponentSources: params.listPackageComponentSources,
      createAssetBaseHref: this.createAssetBaseHref,
      deleteBridgeSessions: this.deleteBridgeSessionsByPanelAppId,
      createStateStore: this.createStateStore,
      createCapabilityGrantStore: this.createCapabilityGrantStore,
      createClientGrantStore: this.createClientGrantStore,
    });
    this.entryPresenter = new PanelAppEntryPresenter({
      contentBasePath: PANEL_APP_CONTENT_BASE_PATH,
      createAssetBaseHref: this.createAssetBaseHref,
      isClientGranted: this.isPanelAppClientGranted,
    });
  }

  listPanelApps = async (): Promise<PanelAppList> => {
    const workspacePath = this.getWorkspacePath();
    const panelsPath = this.getPanelsPath(workspacePath);
    const sources = await this.packageStateManager.listSources();
    const appState = await this.createStateStore(panelsPath).load();
    const entries = await Promise.all(
      sources.map(({ source, packageSource }) =>
        this.entryPresenter.build(
          source,
          appState.apps[encodePanelAppId(source.sourceName)] ?? {},
          packageSource,
          appState.mainSidebarAppIds,
        ),
      ),
    );

    return {
      workspacePath,
      panelsPath,
      entries: entries.sort(this.entryPresenter.compare),
    };
  };

  getPanelAppContent = async (id: string, sourcePath?: string): Promise<PanelAppContent> => {
    try {
      const resolved = sourcePath
        ? await readPanelAppContentSourceByIdOrPath({
            createAssetBaseHref: this.createAssetBaseHref,
            id,
            panelsPath: this.getPanelsPath(this.getWorkspacePath()),
            sourcePath,
            sourceService: this.sourceService,
          })
        : await this.packageStateManager.readContentSourceByIdOrAppId(id);
      const clientGranted = await this.isPanelAppClientGranted(
        resolved.appId,
        resolved.manifest.client,
      );
      const session = this.createPanelAppRuntimeTokenSession({
        appId: resolved.appId,
        clientDeclared: resolved.manifest.client,
        declaredActions: resolved.manifest.serviceActions,
        declaredCapabilities: resolved.manifest.capabilities,
      });
      const htmlWithBridge = injectPanelAppBridgeScript(resolved.htmlWithBase, {
        appId: resolved.appId,
        runtimeToken: session.token,
      });
      const html = resolved.manifest.client && clientGranted
        ? injectPanelAppClientScript(htmlWithBridge, { runtimeToken: session.token })
        : htmlWithBridge;
      return {
        id: resolved.sourceId,
        appId: resolved.appId,
        fileName: resolved.source.sourceName,
        html,
        capabilities: resolved.manifest.capabilities,
        clientDeclared: resolved.manifest.client,
        clientGranted,
        contentType: PANEL_APP_CONTENT_TYPE,
        serviceActions: resolved.manifest.serviceActions,
      };
    } catch (error) {
      if (isPanelAppError(error)) {
        throw error;
      }
      if (this.isMissingFileError(error)) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      }
      throw new PanelAppError(
        "PANEL_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  getPanelAppAsset = async (id: string, assetPath: string): Promise<PanelAppAsset> => {
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    return await this.sourceService.getAsset(panelsPath, id, assetPath);
  };

  getPanelAppAssetByToken = async (
    token: string,
    assetPath: string,
  ): Promise<PanelAppAsset> => {
    const claims = this.assetTokenService.verify(token);
    if (encodePanelAppId(claims.sourceName) !== claims.panelAppId) {
      throw new PanelAppError(
        "PANEL_APP_ASSET_TOKEN_INVALID",
        "invalid panel app asset token",
      );
    }
    return await this.sourceService.getAssetBySourcePath(claims.sourcePath, assetPath);
  };

  getPanelAppBridgeScript = (): string =>
    getPanelAppBridgeScript({ appId: "", runtimeToken: "" });

  createPanelAppRuntimeTokenSession = (params: {
    appId: string;
    clientDeclared: boolean;
    declaredActions: string[];
    declaredCapabilities: string[];
  }): PanelAppBridgeSession => {
    const {
      appId,
      clientDeclared,
      declaredActions,
      declaredCapabilities,
    } = params;
    const now = new Date();
    const session: PanelAppBridgeSession = {
      id: randomUUID(),
      token: randomUUID(),
      appId,
      caller: {
        surface: "panel-app",
        appId,
      },
      declaredCapabilities,
      declaredActions,
      clientDeclared,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PANEL_APP_RUNTIME_TOKEN_TTL_MS).toISOString(),
    };
    this.bridgeSessions.set(session.token, session);
    return session;
  };

  createPanelAppBridgeSession = async (params: {
    id: string;
  }): Promise<PanelAppBridgeSession> => {
    const resolved = await this.packageStateManager.readContentSourceByIdOrAppId(params.id);
    return this.createPanelAppRuntimeTokenSession({
      appId: resolved.appId,
      clientDeclared: resolved.manifest.client,
      declaredActions: resolved.manifest.serviceActions,
      declaredCapabilities: resolved.manifest.capabilities,
    });
  };

  grantPanelAppClient = async (appId: string): Promise<PanelAppClientGrant> => {
    await this.packageStateManager.assertDeclaresClient(appId);
    return await this.createClientGrantStore().grant({
      appId,
      grantedAt: new Date().toISOString(),
    });
  };

  revokePanelAppClient = async (appId: string): Promise<void> => {
    await this.createClientGrantStore().revoke(appId);
  };

  resolvePanelAppBridgeSession = (token: string): PanelAppBridgeSession => {
    this.deleteExpiredBridgeSessions();
    const session = this.bridgeSessions.get(token.trim());
    if (!session) {
      throw new PanelAppError(
        "PANEL_APP_BRIDGE_SESSION_NOT_FOUND",
        "panel app bridge session not found",
      );
    }
    return session;
  };

  deletePanelAppBridgeSession = (token: string): void => {
    this.bridgeSessions.delete(token.trim());
  };

  sendAgentMessage = async (
    bridgeSessionToken: string,
    payload: PanelAppAgentSendPayload,
  ): Promise<PanelAppAgentSendResult> => {
    const bridgeSession = this.resolvePanelAppBridgeSession(bridgeSessionToken);
    return await this.agentBridgeService.sendAgentMessage(bridgeSession, payload);
  };

  generateAgentObject = async (
    bridgeSessionToken: string,
    input: PanelAppAgentGenerateObjectInput,
  ): Promise<PanelAppAgentGenerateObjectResult> => {
    const bridgeSession = this.resolvePanelAppBridgeSession(bridgeSessionToken);
    return await this.agentBridgeService.generateAgentObject(bridgeSession, input);
  };

  grantAgentCapability = async (
    bridgeSessionToken: string,
    capability: PanelAppAgentCapability,
  ): Promise<PanelAppCapabilityGrant> => {
    const bridgeSession = this.resolvePanelAppBridgeSession(bridgeSessionToken);
    return await this.agentBridgeService.grantAgentCapability(bridgeSession, capability);
  };

  updatePanelAppPreferences = async (
    id: string,
    preferences: PanelAppPreferencesUpdate,
  ): Promise<PanelAppEntry> => {
    const fileName = await this.resolvePanelAppFileName(id);
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const source = await this.packageStateManager.resolveSource(encodePanelAppId(fileName));
    const packageSource = await this.packageStateManager.findPackageSourceBySourceName(fileName);
    const manifest = source.manifest ?? parsePanelAppManifest(await readFile(source.entryPath, "utf8"));
    const appId = resolvePanelAppAppId(source, manifest);
    const result = await this.createStateStore(panelsPath).updatePreferences(
      encodePanelAppId(fileName), appId, preferences,
    );
    return await this.entryPresenter.build(
      source, result.entry, packageSource, result.mainSidebarAppIds,
    );
  };

  recordPanelAppOpened = async (id: string): Promise<PanelAppEntry> => {
    const fileName = await this.resolvePanelAppFileName(id);
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const result = await this.createStateStore(panelsPath).recordOpened(
      encodePanelAppId(fileName),
    );
    return await this.entryPresenter.build(
      await this.packageStateManager.resolveSource(encodePanelAppId(fileName)),
      result.entry,
      await this.packageStateManager.findPackageSourceBySourceName(fileName),
      result.mainSidebarAppIds,
    );
  };

  deletePanelApp = async (id: string): Promise<PanelAppDeleteResult> => {
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const source = await this.packageStateManager.resolveSource(id);
    const packageSource = await this.packageStateManager.findPackageSourceBySourceName(
      source.sourceName,
    );
    if (packageSource) {
      throw new PanelAppError(
        "PANEL_APP_MANAGED_SOURCE",
        `package panel must be managed through Apps: ${packageSource.packageId}`,
      );
    }
    const panelAppId = encodePanelAppId(source.sourceName);
    const manifest = source.manifest ?? parsePanelAppManifest(await readFile(source.entryPath, "utf8"));
    const appId = resolvePanelAppAppId(source, manifest);
    await rm(source.sourcePath, { recursive: source.kind === "folder" });
    await this.createStateStore(panelsPath).deleteEntry(panelAppId, appId);
    await this.createCapabilityGrantStore().deleteCaller({
      surface: "panel-app",
      appId,
    });
    await this.createClientGrantStore().revoke(appId);
    this.deleteBridgeSessionsByPanelAppId(appId);
    return { deleted: true, fileName: source.sourceName, id: panelAppId };
  };

  private getWorkspacePath = (): string =>
    getWorkspacePathFromConfig(this.params.configManager.config);

  private getPanelsPath = (workspacePath: string): string =>
    join(workspacePath, DEFAULT_PANELS_DIR);

  private createAssetBaseHref = (source: PanelAppSource): string => {
    const token = this.assetTokenService.issue({
      panelAppId: encodePanelAppId(source.sourceName),
      sourceName: source.sourceName,
      sourcePath: source.sourcePath,
    });
    return `${PANEL_APP_TOKENIZED_ASSET_BASE_PATH}/${encodeURIComponent(token)}/`;
  };

  private createStateStore = (panelsPath: string): PanelAppStateStore =>
    new PanelAppStateStore(panelsPath);

  private createCapabilityGrantStore = (): PanelAppCapabilityGrantStore =>
    new PanelAppCapabilityGrantStore(
      join(this.getPanelsPath(this.getWorkspacePath()), PANEL_APP_CAPABILITY_GRANTS_FILE_NAME),
    );

  private createClientGrantStore = (): PanelAppClientGrantStore =>
    new PanelAppClientGrantStore(
      join(this.getPanelsPath(this.getWorkspacePath()), PANEL_APP_CLIENT_GRANTS_FILE_NAME),
    );

  private resolvePanelAppFileName = async (id: string): Promise<string> => {
    const source = await this.packageStateManager.resolveSource(id);
    return source.sourceName;
  };

  assertCanActivatePackageComponents = async (
    components: AppPackageComponentSource[],
  ): Promise<void> => await this.packageStateManager.assertCanActivate(components);

  deactivatePackageComponents = (
    components: AppPackageComponentSource[],
  ): void => this.packageStateManager.deactivate(components);

  removePackageComponentState = async (
    components: AppPackageComponentSource[],
  ): Promise<void> => await this.packageStateManager.removeState(components);

  private deleteExpiredBridgeSessions = (): void => {
    const now = Date.now();
    for (const [token, session] of this.bridgeSessions) {
      if (new Date(session.expiresAt).getTime() <= now) {
        this.bridgeSessions.delete(token);
      }
    }
  };

  private deleteBridgeSessionsByPanelAppId = (panelAppId: string): void => {
    for (const [token, session] of this.bridgeSessions) {
      if (session.appId === panelAppId) {
        this.bridgeSessions.delete(token);
      }
    }
  };

  private isPanelAppClientGranted = async (
    appId: string,
    clientDeclared: boolean,
  ): Promise<boolean> => {
    if (!clientDeclared) {
      return false;
    }
    return await this.createClientGrantStore().isGranted(appId);
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
