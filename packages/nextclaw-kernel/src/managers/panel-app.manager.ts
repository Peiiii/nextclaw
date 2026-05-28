import { randomUUID } from "node:crypto";
import { readdir, readFile, rm, stat } from "node:fs/promises";
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
  PanelAppError,
} from "@kernel/types/panel-app.types.js";
import { AgentRunClient } from "@kernel/services/agent-run-client.service.js";
import {
  getPanelAppBridgeScript,
  injectPanelAppBridgeScript,
} from "@kernel/utils/panel-app-bridge.utils.js";
import { parsePanelAppManifest } from "@kernel/utils/panel-app-manifest.utils.js";
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

const PANEL_APP_FILE_SUFFIX = ".panel.html";
const PANEL_APP_CONTENT_BASE_PATH = "/api/panel-apps";
const PANEL_APP_CONTENT_TYPE = "text/html; charset=utf-8" as const;
const PANEL_APP_CAPABILITY_GRANTS_FILE_NAME = ".panel-app-capability-grants.json";

export type PanelAppEntry = {
  id: string;
  fileName: string;
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
    const fileNames = await this.listPanelAppFileNames(panelsPath);
    const appState = await this.createStateStore(panelsPath).load();
    const entries = await Promise.all(
      fileNames.map((fileName) =>
        this.buildPanelAppEntry(
          panelsPath,
          fileName,
          appState[this.encodePanelAppId(fileName)] ?? {},
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
    const fileName = this.decodePanelAppId(id);
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const filePath = join(panelsPath, fileName);

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      }
      const html = await readFile(filePath, "utf8");
      const manifest = parsePanelAppManifest(html);
      return {
        id: this.encodePanelAppId(fileName),
        fileName,
        html: injectPanelAppBridgeScript(html),
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
      this.encodePanelAppId(fileName),
      preferences,
    );
    return await this.buildPanelAppEntry(panelsPath, fileName, state);
  };

  recordPanelAppOpened = async (id: string): Promise<PanelAppEntry> => {
    const fileName = await this.resolvePanelAppFileName(id);
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const state = await this.createStateStore(panelsPath).recordOpened(
      this.encodePanelAppId(fileName),
    );
    return await this.buildPanelAppEntry(panelsPath, fileName, state);
  };

  deletePanelApp = async (id: string) => {
    const fileName = await this.resolvePanelAppFileName(id);
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const panelAppId = this.encodePanelAppId(fileName);
    await rm(join(panelsPath, fileName));
    await this.createStateStore(panelsPath).deleteEntry(panelAppId);
    await this.createCapabilityGrantStore().deleteCaller({
      surface: "panel-app",
      appId: panelAppId,
    });
    this.deleteBridgeSessionsByPanelAppId(panelAppId);
    return { deleted: true as const, fileName, id: panelAppId };
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
        "panel app did not declare this agent capability",
      );
    }
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

  private listPanelAppFileNames = async (panelsPath: string): Promise<string[]> => {
    try {
      const entries = await readdir(panelsPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && this.isPanelAppFileName(entry.name))
        .map((entry) => entry.name);
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return [];
      }
      throw new PanelAppError(
        "PANEL_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  private buildPanelAppEntry = async (
    panelsPath: string,
    fileName: string,
    state: PanelAppStateEntry,
  ): Promise<PanelAppEntry> => {
    const filePath = join(panelsPath, fileName);
    const [fileStat, html] = await Promise.all([
      stat(filePath),
      readFile(filePath, "utf8"),
    ]);
    const manifest = parsePanelAppManifest(html);
    const id = this.encodePanelAppId(fileName);
    const createdAt = resolvePanelAppCreatedAt(fileStat);
    const updatedAt = fileStat.mtime.toISOString();
    const entry: PanelAppEntry = {
      id,
      fileName,
      title: manifest.title ?? this.toPanelAppTitle(fileName),
      contentPath: `${PANEL_APP_CONTENT_BASE_PATH}/${encodeURIComponent(id)}/content`,
      createdAt,
      updatedAt,
      sizeBytes: fileStat.size,
      favorite: state.favorite ?? false,
      openCount: state.openCount ?? 0,
    };
    if (manifest.description) {
      entry.description = manifest.description;
    }
    if (manifest.icon) {
      entry.icon = manifest.icon;
    }
    if (state.lastOpenedAt) {
      entry.lastOpenedAt = state.lastOpenedAt;
    }
    return entry;
  };

  private resolvePanelAppFileName = async (id: string): Promise<string> => {
    const fileName = this.decodePanelAppId(id);
    const panelsPath = this.getPanelsPath(this.getWorkspacePath());
    const filePath = join(panelsPath, fileName);
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile()) {
        return fileName;
      }
    } catch (error) {
      if (this.isMissingFileError(error)) {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      }
      throw new PanelAppError(
        "PANEL_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
    throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
  };

  private encodePanelAppId = (fileName: string): string =>
    Buffer.from(fileName, "utf8").toString("base64url");

  private decodePanelAppId = (id: string): string => {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new PanelAppError("PANEL_APP_INVALID_ID", "panel app id is required");
    }
    let fileName = "";
    try {
      fileName = Buffer.from(normalizedId, "base64url").toString("utf8");
    } catch {
      throw new PanelAppError("PANEL_APP_INVALID_ID", "invalid panel app id");
    }
    if (
      this.encodePanelAppId(fileName) !== normalizedId ||
      !this.isPanelAppFileName(fileName)
    ) {
      throw new PanelAppError("PANEL_APP_INVALID_ID", "invalid panel app id");
    }
    return fileName;
  };

  private isPanelAppFileName = (fileName: string): boolean =>
    fileName.endsWith(PANEL_APP_FILE_SUFFIX) &&
    !fileName.includes("/") &&
    !fileName.includes("\\") &&
    !fileName.includes("\0");

  private toPanelAppTitle = (fileName: string): string =>
    fileName
      .slice(0, -PANEL_APP_FILE_SUFFIX.length)
      .replace(/[-_]+/g, " ")
      .trim() || fileName;

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
