import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_PANELS_DIR,
  getWorkspacePathFromConfig,
} from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { PanelAppStateStore } from "@kernel/stores/panel-app-state.store.js";
import type { PanelAppPreferencesUpdate, PanelAppStateEntry } from "@kernel/stores/panel-app-state.store.js";
import { PanelAppCapabilityGrantStore } from "@kernel/stores/panel-app-capability-grant.store.js";
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
  isPanelAppAgentCapability,
  isPanelAppError,
  PANEL_APP_AGENT_CAPABILITIES,
  PanelAppError,
} from "@kernel/types/panel-app.types.js";
import { AgentRunClient } from "@kernel/services/agent-run-client.service.js";
import {
  getPanelAppBridgeScript,
  injectPanelAppBridgeScript,
} from "@kernel/utils/panel-app-bridge.utils.js";
import { parsePanelAppManifest } from "@kernel/utils/panel-app-manifest.utils.js";
import {
  encodePanelAppId,
  injectPanelAppAssetBase,
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
  createPanelAppAgentMetadata,
  createPanelAppGenerateObjectMessage,
  normalizePanelAppGenerateObjectInput,
  waitForPanelAppStructuredResult,
  withPanelAppAgentMetadata,
} from "@kernel/utils/panel-app-agent.utils.js";
import type {
  EventBus,
  Ingress,
} from "@nextclaw/shared";

export type { PanelAppPreferencesUpdate } from "@kernel/stores/panel-app-state.store.js";

const PANEL_APP_CONTENT_BASE_PATH = "/api/panel-apps";
const PANEL_APP_CONTENT_TYPE = "text/html; charset=utf-8" as const;
const PANEL_APP_CAPABILITY_GRANTS_FILE_NAME = ".panel-app-capability-grants.json";

export type PanelAppEntry = {
  id: string;
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
  fileName: string;
  html: string;
  contentType: typeof PANEL_APP_CONTENT_TYPE;
  capabilities: string[];
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
  panelAppId: string;
  tabId: string;
  caller: ServiceActionCaller;
  declaredCapabilities: string[];
  declaredActions: string[];
  createdAt: string;
  expiresAt: string;
};

export class PanelAppManager {
  private readonly bridgeSessions = new Map<string, PanelAppBridgeSession>();
  private readonly agentRunClient: PanelAppAgentRunClient | null;
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

  getPanelAppContent = async (id: string): Promise<PanelAppContent> => {
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());

    try {
      const source = await this.sourceService.resolveSource(panelsPath, id);
      const html = await readFile(source.entryPath, "utf8");
      const manifest = source.manifest ?? parsePanelAppManifest(html);
      const sourceId = encodePanelAppId(source.sourceName);
      const htmlWithBase = source.kind === "folder"
        ? injectPanelAppAssetBase(html, sourceId)
        : html;
      return {
        id: sourceId,
        fileName: source.sourceName,
        html: injectPanelAppBridgeScript(htmlWithBase),
        capabilities: manifest.capabilities,
        contentType: PANEL_APP_CONTENT_TYPE,
        serviceActions: manifest.serviceActions,
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

  getPanelAppBridgeScript = (): string => getPanelAppBridgeScript();

  createPanelAppBridgeSession = async (params: {
    id: string;
    tabId: string;
  }): Promise<PanelAppBridgeSession> => {
    const content = await this.getPanelAppContent(params.id);
    const now = new Date();
    const session: PanelAppBridgeSession = {
      id: randomUUID(),
      token: randomUUID(),
      panelAppId: content.id,
      tabId: params.tabId,
      caller: {
        surface: "panel-app",
        appId: content.id,
      },
      declaredCapabilities: content.capabilities,
      declaredActions: content.serviceActions,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    };
    this.bridgeSessions.set(session.token, session);
    return session;
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
    await this.assertAgentCapabilityGranted(bridgeSession, "agent:send");
    return await this.requireAgentRunClient().send(
      withPanelAppAgentMetadata(payload, bridgeSession),
    );
  };

  generateAgentObject = async (
    bridgeSessionToken: string,
    input: PanelAppAgentGenerateObjectInput,
  ): Promise<PanelAppAgentGenerateObjectResult> => {
    const bridgeSession = this.resolvePanelAppBridgeSession(bridgeSessionToken);
    await this.assertAgentCapabilityGranted(bridgeSession, "agent:generateObject");
    const request = normalizePanelAppGenerateObjectInput(input);
    const requestId = randomUUID();
    const message = createPanelAppGenerateObjectMessage({
      bridgeSession,
      request,
      requestId,
    });
    const result = await waitForPanelAppStructuredResult(this.requireAgentRunClient(), {
      payload: {
        message,
        metadata: {
          ...createPanelAppAgentMetadata(bridgeSession),
          panel_app_peer_id: request.peerId,
        },
        peerId: request.peerId,
      },
      timeoutMs: request.timeoutMs,
    });
    return { result };
  };

  grantAgentCapability = async (
    bridgeSessionToken: string,
    capability: PanelAppAgentCapability,
  ): Promise<PanelAppCapabilityGrant> => {
    const bridgeSession = this.resolvePanelAppBridgeSession(bridgeSessionToken);
    if (!isPanelAppAgentCapability(capability)) {
      throw new PanelAppError(
        "PANEL_APP_AGENT_REQUEST_INVALID",
        "unknown panel app agent capability",
      );
    }
    this.assertDeclaredCapability(bridgeSession, capability);
    return await this.createCapabilityGrantStore().grant({
      caller: bridgeSession.caller,
      capability,
      grantedAt: new Date().toISOString(),
    });
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
    await rm(source.sourcePath, { recursive: source.kind === "folder" });
    await this.createStateStore(panelsPath).deleteEntry(panelAppId);
    await this.createCapabilityGrantStore().deleteCaller({
      surface: "panel-app",
      appId: panelAppId,
    });
    this.deleteBridgeSessionsByPanelAppId(panelAppId);
    return { deleted: true, fileName: source.sourceName, id: panelAppId };
  };

  private assertAgentCapabilityGranted = async (
    bridgeSession: PanelAppBridgeSession,
    capability: PanelAppAgentCapability,
  ): Promise<void> => {
    this.assertDeclaredCapability(bridgeSession, capability);
    const granted = await this.createCapabilityGrantStore().isGranted(
      bridgeSession.caller,
      capability,
    );
    if (!granted) {
      throw new PanelAppError(
        "AUTHORIZATION_REQUIRED",
        `This panel app needs permission to use ${capability}.`,
      );
    }
  };

  private assertDeclaredCapability = (
    bridgeSession: PanelAppBridgeSession,
    capability: PanelAppAgentCapability,
  ): void => {
    if (!bridgeSession.declaredCapabilities.includes(capability)) {
      throw new PanelAppError(
        "PANEL_APP_CAPABILITY_NOT_DECLARED",
        this.describeMissingAgentCapability(bridgeSession.declaredCapabilities, capability),
      );
    }
  };

  private describeMissingAgentCapability = (
    declaredCapabilities: string[],
    capability: PanelAppAgentCapability,
  ): string => {
    const declared = declaredCapabilities.length > 0
      ? declaredCapabilities.join(", ")
      : "none";
    const valid = PANEL_APP_AGENT_CAPABILITIES.join(", ");
    const hint = declaredCapabilities.includes(capability.replace(":", "."))
      ? ` Use ${capability}, not ${capability.replace(":", ".")}.`
      : "";
    return [
      `panel app did not declare ${capability}.`,
      `Declared: ${declared}.`,
      `Valid capabilities: ${valid}.`,
      `Declare it with nextclaw-panel-capabilities or panel-app.json capabilities.`,
      hint.trim(),
    ].filter(Boolean).join(" ");
  };

  private requireAgentRunClient = (): PanelAppAgentRunClient => {
    if (!this.agentRunClient) {
      throw new PanelAppError(
        "PANEL_APP_AGENT_REQUEST_INVALID",
        "panel app agent client is not configured",
      );
    }
    return this.agentRunClient;
  };

  private getWorkspacePath = (): string =>
    getWorkspacePathFromConfig(this.params.configManager.config);

  private getPanelsPath = (workspacePath: string): string =>
    join(workspacePath, DEFAULT_PANELS_DIR);

  private createStateStore = (panelsPath: string): PanelAppStateStore =>
    new PanelAppStateStore(panelsPath);

  private createCapabilityGrantStore = (): PanelAppCapabilityGrantStore =>
    new PanelAppCapabilityGrantStore(
      join(this.getPanelsPath(this.getWorkspacePath()), PANEL_APP_CAPABILITY_GRANTS_FILE_NAME),
    );

  private buildPanelAppEntry = async (
    source: PanelAppSource,
    state: PanelAppStateEntry,
  ): Promise<PanelAppEntry> => {
    const manifest = source.manifest ?? parsePanelAppManifest(await readFile(source.entryPath, "utf8"));
    const id = encodePanelAppId(source.sourceName);
    const createdAt = resolvePanelAppCreatedAt(source.sourceStat);
    const updatedAt = source.sourceStat.mtime.toISOString();
    const entry: PanelAppEntry = {
      id,
      fileName: source.sourceName,
      kind: source.kind,
      title: manifest.title ?? toPanelAppTitle(source.sourceName),
      contentPath: `${PANEL_APP_CONTENT_BASE_PATH}/${encodeURIComponent(id)}/content`,
      createdAt,
      updatedAt,
      sizeBytes: source.sourceStat.size,
      favorite: state.favorite ?? false,
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
      if (session.panelAppId === panelAppId) {
        this.bridgeSessions.delete(token);
      }
    }
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
