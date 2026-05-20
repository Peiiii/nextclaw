import { Hono, type Handler } from "hono";
import type {
  NcpAgentSendEnvelope,
  NcpEndpointEvent,
  NcpMessageAbortPayload,
  NcpStreamRequestPayload,
} from "@nextclaw/ncp";
import type { IngressEnvelope } from "@nextclaw/shared";
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
  normalizeMarketplaceBaseUrl,
  PluginMarketplaceController,
  SkillMarketplaceController
} from "@nextclaw-server/features/marketplace/index.js";
import { RemoteRoutesController } from "@nextclaw-server/features/remote-access/index.js";
import { RuntimeControlRoutesController } from "@nextclaw-server/features/runtime-control/index.js";
import { RuntimeUpdateRoutesController } from "@nextclaw-server/features/runtime-update/index.js";
import { err, ok, readJson } from "@nextclaw-server/shared/utils/http-response.utils.js";
import { ServerPathRoutesController } from "@nextclaw-server/features/server-path/index.js";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
}

function isValidIngressEnvelope(value: IngressEnvelope): boolean {
  return typeof value.type === "string" && value.type.trim().length > 0;
}

const NCP_AGENT_BASE_PATH = "/api/ncp/agent";

function createUiRouteControllers(
  options: UiRouterOptions,
  authService: UiAuthService,
  marketplaceBaseUrl: string
) {
  const { remoteAccess, runtimeControl, runtimeUpdate } = options;
  return {
    app: new AppRoutesController(options),
    agents: new AgentsRoutesController(options),
    auth: new AuthRoutesController(authService),
    config: new ConfigRoutesController(options),
    cron: new CronRoutesController(options),
    ncpSession: new NcpSessionRoutesController(options),
    ncpAsset: new NcpAssetRoutesController(options),
    serverPath: new ServerPathRoutesController(),
    remote: remoteAccess ? new RemoteRoutesController(remoteAccess) : null,
    runtimeControl: runtimeControl ? new RuntimeControlRoutesController(runtimeControl) : null,
    runtimeUpdate: runtimeUpdate ? new RuntimeUpdateRoutesController(runtimeUpdate) : null,
    pluginMarketplace: new PluginMarketplaceController(options, marketplaceBaseUrl),
    skillMarketplace: new SkillMarketplaceController(options, marketplaceBaseUrl),
    mcpMarketplace: new McpMarketplaceController(options, marketplaceBaseUrl)
  };
}

type UiRouteControllers = ReturnType<typeof createUiRouteControllers>;
type HttpMethod = "delete" | "get" | "post" | "put";
type RouteDefinition = readonly [HttpMethod, string, Handler];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidSendEnvelope(value: unknown): value is NcpAgentSendEnvelope {
  return isRecord(value) &&
    (!Object.prototype.hasOwnProperty.call(value, "sessionId") ||
      (typeof value.sessionId === "string" && value.sessionId.trim().length > 0)) &&
    isRecord(value.message);
}

function readStreamPayload(url: string): NcpStreamRequestPayload | null {
  const sessionId = new URL(url).searchParams.get("sessionId")?.trim();
  return sessionId ? { sessionId } : null;
}

function isAbortPayload(value: unknown): value is NcpMessageAbortPayload {
  return isRecord(value) && typeof value.sessionId === "string" && value.sessionId.trim().length > 0;
}

function toSseFrame(eventName: string, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

function createNcpEventStreamResponse(
  events: AsyncIterable<NcpEndpointEvent>,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      signal.addEventListener("abort", close, { once: true });
      try {
        for await (const event of events) {
          if (closed || signal.aborted) {
            break;
          }
          controller.enqueue(encoder.encode(toSseFrame("ncp-event", event)));
        }
      } catch (error) {
        if (!closed && !signal.aborted) {
          controller.enqueue(encoder.encode(toSseFrame("error", {
            code: "STREAM_SOURCE_FAILED",
            message: error instanceof Error ? error.message : String(error),
          })));
        }
      } finally {
        signal.removeEventListener("abort", close);
        close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
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

  private readonly mountNcpAgentRoutes = (
    agentRunRequests: NonNullable<UiRouterOptions["agentRunRequests"]>,
    ncpAsset: UiRouteControllers["ncpAsset"],
  ): void => {
    this.app.post(`${NCP_AGENT_BASE_PATH}/send`, async (c) => {
      const body = await readJson<NcpAgentSendEnvelope>(c.req.raw);
      if (!body.ok || !isValidSendEnvelope(body.data)) {
        return c.json(err("INVALID_BODY", "Invalid NCP request envelope."), 400);
      }
      const handle = await agentRunRequests.send(body.data);
      return c.json(ok(handle));
    });
    this.app.get(`${NCP_AGENT_BASE_PATH}/stream`, (c) => {
      const payload = readStreamPayload(c.req.raw.url);
      if (!payload) {
        return c.json(err("INVALID_QUERY", "sessionId is required."), 400);
      }
      return createNcpEventStreamResponse(
        agentRunRequests.stream(payload, { signal: c.req.raw.signal }),
        c.req.raw.signal,
      );
    });
    this.app.post(`${NCP_AGENT_BASE_PATH}/abort`, async (c) => {
      const body = await readJson<NcpMessageAbortPayload>(c.req.raw);
      if (!body.ok || !isAbortPayload(body.data)) {
        return c.json(err("INVALID_BODY", "sessionId is required."), 400);
      }
      await agentRunRequests.abort(body.data);
      return c.json(ok({ accepted: true }));
    });
    this.mountRoutes([
      ["post", "/api/ncp/assets", ncpAsset.putAssets],
      ["get", "/api/ncp/assets/content", ncpAsset.getAssetContent],
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
      ncpSession,
      remote,
      runtimeControl,
      runtimeUpdate,
      serverPath
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
      ["put", "/api/config/model", config.updateConfigModel],
      ["put", "/api/config/search", config.updateConfigSearch],
      ["put", "/api/config/providers/:provider", config.updateProvider],
      ["post", "/api/config/providers", config.createProvider],
      ["delete", "/api/config/providers/:provider", config.deleteProvider],
      ["post", "/api/config/providers/:provider/test", config.testProviderConnection],
      ["post", "/api/config/providers/:provider/auth/start", config.startProviderAuth],
      ["post", "/api/config/providers/:provider/auth/poll", config.pollProviderAuth],
      ["post", "/api/config/providers/:provider/auth/import-cli", config.importProviderAuthFromCli],
      ["put", "/api/config/channels/:channel", config.updateChannel],
      ["post", "/api/config/channels/:channel/auth/start", config.startChannelAuth],
      ["post", "/api/config/channels/:channel/auth/poll", config.pollChannelAuth],
      ["put", "/api/config/secrets", config.updateSecrets],
      ["put", "/api/config/runtime", config.updateRuntime],
      ["post", "/api/config/actions/:actionId/execute", config.executeAction],
    ]);
    this.mountRoutes([
      ["get", "/api/ncp/session-types", ncpSession.getSessionTypes],
      ["get", "/api/ncp/sessions", ncpSession.listSessions],
      ["get", "/api/ncp/sessions/:sessionId", ncpSession.getSession],
      ["put", "/api/ncp/sessions/:sessionId", ncpSession.patchSession],
      ["get", "/api/ncp/sessions/:sessionId/messages", ncpSession.listSessionMessages],
      ["get", "/api/ncp/sessions/:sessionId/skills", ncpSession.getSessionSkills],
      ["delete", "/api/ncp/sessions/:sessionId", ncpSession.deleteSession],
      ["get", "/api/server-paths/browse", serverPath.browse],
      ["get", "/api/server-paths/read", serverPath.read],
    ]);
    const agentRunRequests = this.options.kernel?.agentRunRequestManager ?? this.options.agentRunRequests;
    const { ingress } = this.options;
    if (agentRunRequests) {
      this.mountNcpAgentRoutes(agentRunRequests, ncpAsset);
    }
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
      if (!ingress) {
        return c.json(err("INGRESS_UNAVAILABLE", "ingress is not configured"), 503);
      }
      const body = await readJson<IngressEnvelope>(c.req.raw);
      if (!body.ok || !isValidIngressEnvelope(body.data)) {
        return c.json(err("INVALID_BODY", "invalid ingress body"), 400);
      }
      try {
        const result = await ingress.handle(body.data, {
          source: "webhook",
          token: readBearerToken(c.req.raw),
        });
        return c.json(ok(result ?? { accepted: true }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.toLowerCase().includes("unauthorized") ? 401 : 400;
        return c.json(err("WEBHOOK_FAILED", message), status);
      }
    });
    mountMarketplaceRoutes(this.app, {
      plugin: this.controllers.pluginMarketplace,
      skill: this.controllers.skillMarketplace,
      mcp: this.controllers.mcpMarketplace
    });
  };
}

export function createUiRouter(options: UiRouterOptions, authServiceOverride?: UiAuthService): Hono {
  const app = new Hono();
  const marketplaceBaseUrl = normalizeMarketplaceBaseUrl(options);
  const authService = authServiceOverride ?? options.authService ?? new UiAuthService(options.configPath);
  const controllers = createUiRouteControllers(options, authService, marketplaceBaseUrl);

  app.notFound((c) => c.json(err("NOT_FOUND", "endpoint not found"), 404));

  app.use("/api/*", async (c, next) => {
    const path = c.req.path;
    if (path === "/api/health" || path === "/api/runtime/bootstrap-status" || path.startsWith("/api/auth/")) {
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
