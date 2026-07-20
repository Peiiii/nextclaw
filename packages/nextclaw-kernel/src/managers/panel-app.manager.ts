import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_PANELS_DIR, getWorkspacePathFromConfig } from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { PanelAppAssetTokenService } from "@kernel/services/panel-app-asset-token.service.js";
import { PanelAppStateStore } from "@kernel/stores/panel-app-state.store.js";
import type { PanelAppPreferencesUpdate, PanelAppStateEntry } from "@kernel/stores/panel-app-state.store.js";
import { PanelAppCapabilityGrantStore } from "@kernel/stores/panel-app-capability-grant.store.js";
import { PanelAppClientGrantStore } from "@kernel/stores/panel-app-client-grant.store.js";
import type { PanelAppClientGrant } from "@kernel/stores/panel-app-client-grant.store.js";
import type { ServiceActionCaller } from "@kernel/types/service-app.types.js";
import type {
  PanelAppAgentCapability,
  PanelAppAgentGenerateObjectInput,
  PanelAppAgentGenerateObjectResult,
  PanelAppAgentRunClient,
  PanelAppAgentSendPayload,
  PanelAppAgentSendResult,
  PanelAppCapabilityGrant,
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
  resolvePanelAppIconUrl,
  toPanelAppTitle,
  type PanelAppAsset,
  type PanelAppSource,
} from "@kernel/utils/panel-app-source.utils.js";
import { PanelAppSourceService } from "@kernel/services/panel-app-source.service.js";
import {
  resolvePanelAppActivityMs,
  resolvePanelAppCreatedAt,
} from "@kernel/utils/panel-app-time.utils.js";
import {
  assertPanelAppDeclaresClient,
  readPanelAppContentSourceByIdOrPath,
  readPanelAppContentSourceByIdOrAppId,
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

export type PanelAppEntry = {
  id: string;
  appId: string;
  fileName: string;
  kind: "single-file" | "folder";
  title: string;
  description?: string;
  icon?: string;
  contentPath: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  favorite: boolean;
  clientDeclared: boolean;
  clientGranted: boolean;
  lastOpenedAt?: string;
  openCount: number;
};

export type PanelAppList = {
  workspacePath: string;
  panelsPath: string;
  entries: PanelAppEntry[];
};

export type PanelAppContent = {
  id: string;
  appId: string;
  fileName: string;
  html: string;
  contentType: typeof PANEL_APP_CONTENT_TYPE;
  capabilities: string[];
  clientDeclared: boolean;
  clientGranted: boolean;
  serviceActions: string[];
};

export type PanelAppDeleteResult = {
  deleted: true;
  fileName: string;
  id: string;
};

export type PanelAppBridgeSession = {
  id: string;
  token: string;
  appId: string;
  caller: ServiceActionCaller;
  declaredCapabilities: string[];
  declaredActions: string[];
  clientDeclared: boolean;
  createdAt: string;
  expiresAt: string;
};

export class PanelAppManager {
  private readonly bridgeSessions = new Map<string, PanelAppBridgeSession>();
  private readonly agentRunClient: PanelAppAgentRunClient | null;
  private readonly agentBridgeService: PanelAppAgentBridgeService;
  private readonly assetTokenService = new PanelAppAssetTokenService();
  private readonly sourceService = new PanelAppSourceService();

  constructor(private readonly params: {
    agentRunClient?: PanelAppAgentRunClient;
    configManager: ConfigManager;
    eventBus?: EventBus;
    ingress?: Ingress;
  }) {
    this.agentRunClient = params.agentRunClient ??
      (params.eventBus && params.ingress
        ? new AgentRunClient({ eventBus: params.eventBus, ingress: params.ingress })
        : null);
    this.agentBridgeService = new PanelAppAgentBridgeService({
      agentRunClient: this.agentRunClient,
      createCapabilityGrantStore: this.createCapabilityGrantStore,
    });
  }

  listPanelApps = async (): Promise<PanelAppList> => {
    const workspacePath = this.getWorkspacePath();
    const panelsPath = this.getPanelsPath(workspacePath);
    const sources = await this.sourceService.listSources(panelsPath);
    const appState = await this.createStateStore(panelsPath).load();
    const entries = await Promise.all(
      sources.map((source) =>
        this.buildPanelAppEntry(
          source,
          appState[encodePanelAppId(source.sourceName)] ?? {},
        ),
      ),
    );

    return {
      workspacePath,
      panelsPath,
      entries: entries.sort(this.comparePanelApps),
    };
  };

  getPanelAppContent = async (id: string, sourcePath?: string): Promise<PanelAppContent> => {
    try {
      const resolved = await readPanelAppContentSourceByIdOrPath({
        createAssetBaseHref: this.createAssetBaseHref,
        id,
        panelsPath: this.getPanelsPath(this.getWorkspacePath()),
        sourcePath,
        sourceService: this.sourceService,
      });
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
    const resolved = await readPanelAppContentSourceByIdOrAppId({
      appIdOrSourceId: params.id,
      createAssetBaseHref: this.createAssetBaseHref,
      panelsPath: this.getPanelsPath(this.getWorkspacePath()),
      sourceService: this.sourceService,
    });
    return this.createPanelAppRuntimeTokenSession({
      appId: resolved.appId,
      clientDeclared: resolved.manifest.client,
      declaredActions: resolved.manifest.serviceActions,
      declaredCapabilities: resolved.manifest.capabilities,
    });
  };

  grantPanelAppClient = async (appId: string): Promise<PanelAppClientGrant> => {
    await assertPanelAppDeclaresClient({
      appId,
      panelsPath: this.getPanelsPath(this.getWorkspacePath()),
      sourceService: this.sourceService,
    });
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
    const state = await this.createStateStore(panelsPath).updatePreferences(
      encodePanelAppId(fileName),
      preferences,
    );
    return await this.buildPanelAppEntry(
      await this.sourceService.resolveSource(panelsPath, encodePanelAppId(fileName)),
      state,
    );
  };

  recordPanelAppOpened = async (id: string): Promise<PanelAppEntry> => {
    const fileName = await this.resolvePanelAppFileName(id);
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const state = await this.createStateStore(panelsPath).recordOpened(
      encodePanelAppId(fileName),
    );
    return await this.buildPanelAppEntry(
      await this.sourceService.resolveSource(panelsPath, encodePanelAppId(fileName)),
      state,
    );
  };

  deletePanelApp = async (id: string): Promise<PanelAppDeleteResult> => {
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const source = await this.sourceService.resolveSource(panelsPath, id);
    const panelAppId = encodePanelAppId(source.sourceName);
    const manifest = source.manifest ?? parsePanelAppManifest(await readFile(source.entryPath, "utf8"));
    const appId = resolvePanelAppAppId(source, manifest);
    await rm(source.sourcePath, { recursive: source.kind === "folder" });
    await this.createStateStore(panelsPath).deleteEntry(panelAppId);
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

  private buildPanelAppEntry = async (
    source: PanelAppSource,
    state: PanelAppStateEntry,
  ): Promise<PanelAppEntry> => {
    const manifest = source.manifest ?? parsePanelAppManifest(await readFile(source.entryPath, "utf8"));
    const id = encodePanelAppId(source.sourceName);
    const appId = resolvePanelAppAppId(source, manifest);
    const createdAt = resolvePanelAppCreatedAt(source.sourceStat);
    const updatedAt = source.sourceStat.mtime.toISOString();
    const entry: PanelAppEntry = {
      id,
      appId,
      fileName: source.sourceName,
      kind: source.kind,
      title: manifest.title ?? toPanelAppTitle(source.sourceName),
      contentPath: `${PANEL_APP_CONTENT_BASE_PATH}/${encodeURIComponent(id)}/content`,
      createdAt,
      updatedAt,
      sizeBytes: source.sourceStat.size,
      favorite: state.favorite ?? false,
      clientDeclared: manifest.client,
      clientGranted: await this.isPanelAppClientGranted(appId, manifest.client),
      openCount: state.openCount ?? 0,
    };
    if (manifest.description) {
      entry.description = manifest.description;
    }
    if (manifest.icon) {
      entry.icon = source.kind === "folder"
        ? resolvePanelAppIconUrl(id, manifest.icon)
        : manifest.icon;
    }
    if (state.lastOpenedAt) {
      entry.lastOpenedAt = state.lastOpenedAt;
    }
    return entry;
  };

  private resolvePanelAppFileName = async (id: string): Promise<string> => {
    const source = await this.sourceService.resolveSource(
      this.getPanelsPath(this.getWorkspacePath()),
      id,
    );
    return source.sourceName;
  };

  private comparePanelApps = (left: PanelAppEntry, right: PanelAppEntry): number =>
    resolvePanelAppActivityMs(right) - resolvePanelAppActivityMs(left) ||
    Number(right.favorite) - Number(left.favorite) ||
    left.title.localeCompare(right.title);

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
