import { Hono, type Handler } from "hono";
import type {
  NcpMessageAbortPayload,
  NcpRunHandle,
  NcpStreamRequestPayload,
} from "@nextclaw/ncp";
import { AccessManager } from "@nextclaw/kernel";
import {
  ingressKeys,
  type AgentRunSendIngressPayload,
  type IngressEnvelope,
} from "@nextclaw/shared";
import { AgentsRoutesController } from "@nextclaw-server/features/agents/index.js";
import { AppRoutesController } from "@nextclaw-server/app/controllers/app.controller.js";
import { AuthRoutesController, UiAuthService } from "@nextclaw-server/features/auth/index.js";
import { ConfigRoutesController } from "@nextclaw-server/features/config/index.js";
import { CronRoutesController } from "@nextclaw-server/features/cron/index.js";
import { NcpAssetRoutesController } from "@nextclaw-server/features/attachments/index.js";
import { NcpSessionRoutesController } from "@nextclaw-server/features/sessions/index.js";
import {
  McpMarketplaceController,
  mountMarketplaceRoutes,
  resolveMarketplaceBaseUrls,
  SkillMarketplaceController
} from "@nextclaw-server/features/marketplace/index.js";
import { RemoteRoutesController } from "@nextclaw-server/features/remote-access/index.js";
import { RuntimeControlRoutesController } from "@nextclaw-server/features/runtime-control/index.js";
import { RuntimeUpdateRoutesController } from "@nextclaw-server/features/runtime-update/index.js";
import { PanelAppsRoutesController } from "@nextclaw-server/features/panel-apps/index.js";
import { PreferencesRoutesController } from "@nextclaw-server/features/preferences/index.js";
import { ServiceAppsRoutesController } from "@nextclaw-server/features/service-apps/index.js";
import { err, ok, readJson } from "@nextclaw-server/shared/utils/http-response.utils.js";
import { createNcpSessionEventStreamResponse } from "@nextclaw-server/app/utils/ncp-session-event-stream.utils.js";
import { ServerPathRoutesController } from "@nextclaw-server/features/server-path/index.js";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";

const NCP_AGENT_BASE_PATH = "/api/ncp/agent";
const AGENT_RUNS_BASE_PATH = "/api/agent-runs";

function createUiRouteControllers(
  options: UiRouterOptions,
  authService: UiAuthService,
  marketplaceBaseUrls: readonly string[]
) {
  const {
    kernel,
    panelAppClientSdkScript,
    remoteAccess,
    runtimeControl,
    runtimeUpdate,
  } = options;
  return {
    app: new AppRoutesController(options),
    agents: new AgentsRoutesController(options),
    auth: new AuthRoutesController(authService),
    config: new ConfigRoutesController(options),
    cron: new CronRoutesController(options),
    ncpSession: new NcpSessionRoutesController(options),
    ncpAsset: new NcpAssetRoutesController(options),
    panelApps: new PanelAppsRoutesController(kernel.panelAppManager, {
      panelAppClientSdkScript,
    }),
    preferences: new PreferencesRoutesController(kernel.preferenceManager),
    serviceApps: new ServiceAppsRoutesController({
      panelAppManager: kernel.panelAppManager,
      serviceAppManager: kernel.serviceAppManager,
    }),
    serverPath: new ServerPathRoutesController(),
    remote: remoteAccess ? new RemoteRoutesController(remoteAccess) : null,
    runtimeControl: runtimeControl ? new RuntimeControlRoutesController(runtimeControl) : null,
    runtimeUpdate: runtimeUpdate ? new RuntimeUpdateRoutesController(runtimeUpdate) : null,
    skillMarketplace: new SkillMarketplaceController(options, marketplaceBaseUrls),
    mcpMarketplace: new McpMarketplaceController(options, marketplaceBaseUrls)
  };
}

type UiRouteControllers = ReturnType<typeof createUiRouteControllers>;
type HttpMethod = "delete" | "get" | "patch" | "post" | "put";
type RouteDefinition = readonly [HttpMethod, string, Handler];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isValidSendEnvelope(value: unknown): value is AgentRunSendIngressPayload {
  if (!isRecord(value)) {
    return false;
  }
  const sessionId = readOptionalSendIdentity(value, "sessionId");
  const peerId = readOptionalSendIdentity(value, "peerId");
  if (sessionId === null || peerId === null || (sessionId && peerId)) {
    return false;
  }
  const hasMessage = hasOwn(value, "message");
  const hasContent = hasOwn(value, "content");
  if (hasMessage === hasContent) {
    return false;
  }
  return hasMessage ? isRecord(value.message) : Array.isArray(value.content);
}

function readOptionalSendIdentity(
  value: Record<string, unknown>,
  key: "peerId" | "sessionId",
): string | null | undefined {
  if (!hasOwn(value, key)) {
    return undefined;
  }
  const raw = value[key];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed || null;
}

function readStreamPayload(url: string): NcpStreamRequestPayload | null {
  const sessionId = new URL(url).searchParams.get("sessionId")?.trim();
  return sessionId ? { sessionId } : null;
}

function isAbortPayload(value: unknown): value is NcpMessageAbortPayload {
  return isRecord(value) && typeof value.sessionId === "string" && value.sessionId.trim().length > 0;
}

class UiRouteRegistry {
  constructor(
    private readonly app: Hono,
    private readonly options: UiRouterOptions,
    private readonly controllers: UiRouteControllers,
  ) {}

  private readonly mountRoutes = (routes: readonly RouteDefinition[]): void => {
    for (const [method, path, handler] of routes) {
      this.app[method](path, handler);
    }
  };

  private readonly mountAgentRunRoutes = (
    basePath: string,
    kernel: UiRouterOptions["kernel"],
  ): void => {
    this.app.post(`${basePath}/send`, async (c) => {
      const body = await readJson<AgentRunSendIngressPayload>(c.req.raw);
      if (!body.ok || !isValidSendEnvelope(body.data)) {
        return c.json(err("INVALID_BODY", "Invalid NCP request envelope."), 400);
      }
      const handle = await kernel.ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>(
        {
          type: ingressKeys.agentRun.send,
          payload: body.data,
        },
        { source: "ui-http" },
      );
      return c.json(ok(handle));
    });
    this.app.get(`${basePath}/stream`, (c) => {
      const payload = readStreamPayload(c.req.raw.url);
      if (!payload) {
        return c.json(err("INVALID_QUERY", "sessionId is required."), 400);
      }
      return createNcpSessionEventStreamResponse(kernel.eventBus, payload, c.req.raw.signal);
    });
    this.app.post(`${basePath}/abort`, async (c) => {
      const body = await readJson<NcpMessageAbortPayload>(c.req.raw);
      if (!body.ok || !isAbortPayload(body.data)) {
        return c.json(err("INVALID_BODY", "sessionId is required."), 400);
      }
      await kernel.ingress.handle<NcpMessageAbortPayload, void>(
        {
          type: ingressKeys.agentRun.abort,
          payload: body.data,
        },
        { source: "ui-http" },
      );
      return c.json(ok({ accepted: true }));
    });
  };

  private readonly mountNcpAgentRoutes = (
    kernel: UiRouterOptions["kernel"],
    ncpAsset: UiRouteControllers["ncpAsset"],
  ): void => {
    this.mountAgentRunRoutes(NCP_AGENT_BASE_PATH, kernel);
    this.mountRoutes([
      ["post", "/api/ncp/assets", ncpAsset.putAssets],
      ["get", "/api/ncp/assets/content", ncpAsset.getAssetContent],
    ]);
  };

  private readonly mountResourceRoutes = (): void => {
    const {
      ncpSession,
      panelApps,
      preferences,
      serviceApps,
      serverPath,
    } = this.controllers;
    this.mountRoutes([
      ["get", "/api/ncp/session-types", ncpSession.getSessionTypes],
      ["get", "/api/ncp/sessions", ncpSession.listSessions],
      ["get", "/api/ncp/sessions/:sessionId", ncpSession.getSession],
      ["put", "/api/ncp/sessions/:sessionId", ncpSession.patchSession],
      ["get", "/api/ncp/sessions/:sessionId/messages", ncpSession.listSessionMessages],
      ["get", "/api/ncp/sessions/:sessionId/skills", ncpSession.getSessionSkills],
      ["delete", "/api/ncp/sessions/:sessionId", ncpSession.deleteSession],
      ["get", "/api/panel-apps", panelApps.list],
      ["get", "/api/panel-app-bridge.js", panelApps.getPanelAppBridgeScript],
      ["get", "/api/panel-app-client-sdk.js", panelApps.getPanelAppClientSdkScript],
      ["post", "/api/panel-app-bridge-sessions", panelApps.createBridgeSession],
      ["delete", "/api/panel-app-bridge-sessions/:token", panelApps.deleteBridgeSession],
      ["post", "/api/panel-app-client-grants/:appId", panelApps.grantClient],
      ["delete", "/api/panel-app-client-grants/:appId", panelApps.revokeClient],
      ["post", "/api/panel-app-agent/send", panelApps.sendAgentMessage],
      ["post", "/api/panel-app-agent/generate-object", panelApps.generateAgentObject],
      ["post", "/api/panel-app-agent-capabilities/:capability/grant", panelApps.grantAgentCapability],
      ["patch", "/api/panel-apps/:id/preferences", panelApps.updatePanelAppPreferences],
      ["get", "/api/preferences/:key", preferences.get],
      ["put", "/api/preferences/:key", preferences.update],
      ["delete", "/api/preferences/:key", preferences.delete],
      ["delete", "/api/panel-apps/:id", panelApps.deletePanelApp],
      ["post", "/api/panel-apps/:id/open", panelApps.recordPanelAppOpened],
      ["get", "/api/panel-apps/:id/content", panelApps.getPanelAppContent],
      ["get", "/api/panel-apps/:id/assets/*", panelApps.getPanelAppAsset],
      ["get", "/api/panel-app-assets/:token/*", panelApps.getPanelAppAssetByToken],
      ["get", "/api/service-apps", serviceApps.listServiceApps],
      ["post", "/api/service-apps/:appId/restart", serviceApps.restartServiceApp],
      ["post", "/api/service-apps/:appId/actions/discover", serviceApps.discoverServiceAppActions],
      ["get", "/api/service-apps/:appId", serviceApps.getServiceApp],
      ["delete", "/api/service-apps/:appId", serviceApps.deleteServiceApp],
      ["get", "/api/service-actions", serviceApps.listServiceActions],
      ["post", "/api/service-actions/:actionId/invoke", serviceApps.invokeServiceAction],
      ["post", "/api/service-actions/:actionId/grant", serviceApps.grantServiceAction],
      ["delete", "/api/service-actions/:actionId/grant", serviceApps.revokeServiceAction],
      ["get", "/api/service-action-grants", serviceApps.listServiceActionGrants],
      ["post", "/api/service-action-grants", serviceApps.grantServiceActions],
      ["delete", "/api/service-action-grants/:actionId", serviceApps.revokeServiceActionGrant],
      ["get", "/api/server-paths/browse", serverPath.browse],
      ["get", "/api/server-paths/read", serverPath.read],
      ["get", "/api/server-paths/content", serverPath.contentByPath],
      ["get", "/api/server-paths/content/*", serverPath.content],
    ]);
  };

  readonly register = (): void => {
    const {
      agents,
      app,
      auth,
      config,
      cron,
      ncpAsset,
      remote,
      runtimeControl,
      runtimeUpdate,
    } = this.controllers;
    this.mountRoutes([
      ["get", "/api/health", app.health],
      ["get", "/api/app/meta", app.appMeta],
      ["get", "/api/runtime/bootstrap-status", app.bootstrapStatus],
      ["get", "/api/auth/status", auth.getStatus],
      ["post", "/api/auth/setup", auth.setup],
      ["post", "/api/auth/login", auth.login],
      ["post", "/api/auth/logout", auth.logout],
      ["put", "/api/auth/password", auth.updatePassword],
      ["put", "/api/auth/enabled", auth.updateEnabled],
      ["post", "/api/auth/bridge", auth.issueBridgeSession],
      ["get", "/api/agents", agents.listAgents],
      ["post", "/api/agents", agents.createAgent],
      ["put", "/api/agents/:agentId", agents.updateAgent],
      ["delete", "/api/agents/:agentId", agents.deleteAgent],
      ["get", "/api/agents/:agentId/avatar", agents.getAgentAvatar],
    ]);
    this.mountRoutes([
      ["get", "/api/config", config.getConfig],
      ["get", "/api/config/meta", config.getConfigMeta],
      ["get", "/api/config/schema", config.getConfigSchema],
      ["get", "/api/providers", config.listProviders],
      ["get", "/api/provider-templates", config.listProviderTemplates],
      ["post", "/api/providers", config.createProvider],
      ["put", "/api/providers/:providerId", config.updateProvider],
      ["delete", "/api/providers/:providerId", config.deleteProvider],
      ["post", "/api/providers/:providerId/test", config.testProviderConnection],
      ["post", "/api/providers/:providerId/auth/start", config.startProviderAuth],
      ["post", "/api/providers/:providerId/auth/poll", config.pollProviderAuth],
      ["post", "/api/providers/:providerId/auth/import-cli", config.importProviderAuthFromCli],
      ["put", "/api/config/model", config.updateConfigModel],
      ["put", "/api/config/search", config.updateConfigSearch],
      ["put", "/api/config/channels/:channel", config.updateChannel],
      ["post", "/api/config/channels/:channel/auth/start", config.startChannelAuth],
      ["post", "/api/config/channels/:channel/auth/connect", config.connectChannelAuth],
      ["post", "/api/config/channels/:channel/auth/poll", config.pollChannelAuth],
      ["put", "/api/config/secrets", config.updateSecrets],
      ["put", "/api/config/runtime", config.updateRuntime],
      ["post", "/api/config/actions/:actionId/execute", config.executeAction],
    ]);
    this.mountResourceRoutes();
    this.mountAgentRunRoutes(AGENT_RUNS_BASE_PATH, this.options.kernel);
    this.mountNcpAgentRoutes(this.options.kernel, ncpAsset);
    this.mountRoutes([
      ["get", "/api/cron", cron.listJobs],
      ["post", "/api/cron", cron.createJob],
      ["delete", "/api/cron/:id", cron.deleteJob],
      ["put", "/api/cron/:id/enable", cron.enableJob],
      ["post", "/api/cron/:id/run", cron.runJob],
    ]);
    if (remote) {
      this.mountRoutes([
        ["get", "/api/remote/status", remote.getStatus],
        ["get", "/api/remote/doctor", remote.getDoctor],
        ["post", "/api/remote/login", remote.login],
        ["post", "/api/remote/auth/start", remote.startBrowserAuth],
        ["post", "/api/remote/auth/poll", remote.pollBrowserAuth],
        ["post", "/api/remote/logout", remote.logout],
        ["put", "/api/remote/account/profile", remote.updateProfile],
        ["put", "/api/remote/settings", remote.updateSettings],
        ["post", "/api/remote/service/:action", remote.controlService],
      ]);
    }
    if (runtimeControl) {
      this.mountRoutes([
        ["get", "/api/runtime/control", runtimeControl.getControl],
        ["post", "/api/runtime/control/start-service", runtimeControl.startService],
        ["post", "/api/runtime/control/restart-service", runtimeControl.restartService],
        ["post", "/api/runtime/control/stop-service", runtimeControl.stopService],
      ]);
    }
    if (runtimeUpdate) {
      this.mountRoutes([
        ["get", "/api/runtime/update", runtimeUpdate.getState],
        ["post", "/api/runtime/update/check", runtimeUpdate.checkForUpdates],
        ["post", "/api/runtime/update/download", runtimeUpdate.downloadUpdate],
        ["post", "/api/runtime/update/apply", runtimeUpdate.applyDownloadedUpdate],
        ["put", "/api/runtime/update/preferences", runtimeUpdate.updatePreferences],
        ["put", "/api/runtime/update/channel", runtimeUpdate.updateChannel],
      ]);
    }
    this.app.post("/webhook", async (c) => {
      const ingress = this.options.kernel.ingress;
      const body = await readJson<IngressEnvelope>(c.req.raw);
      if (!body.ok) {
        return c.json(err("INVALID_BODY", "invalid ingress body"), 400);
      }
      try {
        const result = await ingress.handle(body.data, {
          source: "webhook",
          token: /^Bearer\s+(.+)$/i.exec(c.req.raw.headers.get("authorization")?.trim() ?? "")?.[1]?.trim() || null,
        });
        return c.json(ok(result ?? { accepted: true }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.toLowerCase().includes("unauthorized") ? 401 : 400;
        return c.json(err("WEBHOOK_FAILED", message), status);
      }
    });
    mountMarketplaceRoutes(this.app, {
      skill: this.controllers.skillMarketplace,
      mcp: this.controllers.mcpMarketplace
    });
  };
}

export function createUiRouter(options: UiRouterOptions, authServiceOverride?: UiAuthService): Hono {
  const app = new Hono();
  const marketplaceBaseUrls = resolveMarketplaceBaseUrls(options);
  const authService = authServiceOverride ?? options.authService ?? new UiAuthService(
    options.kernel.accessManager ?? new AccessManager({ configPath: options.configPath }),
  );
  const controllers = createUiRouteControllers(options, authService, marketplaceBaseUrls);

  app.notFound((c) => c.json(err("NOT_FOUND", "endpoint not found"), 404));

  app.use("/api/*", async (c, next) => {
    const path = c.req.path;
    if (
      path === "/api/health" ||
      path === "/api/runtime/bootstrap-status" ||
      path.startsWith("/api/auth/") ||
      path.startsWith("/api/panel-app-assets/")
    ) {
      await next();
      return;
    }
    if (!authService.isProtectionEnabled() || authService.isRequestAuthenticated(c.req.raw)) {
      await next();
      return;
    }
    c.status(401);
    return c.json(err("UNAUTHORIZED", "Authentication required."), 401);
  });

  new UiRouteRegistry(app, options, controllers).register();

  return app;
}
