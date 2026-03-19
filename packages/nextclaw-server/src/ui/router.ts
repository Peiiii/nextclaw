import { Hono } from "hono";
import { mountNcpHttpAgentRoutes } from "@nextclaw/ncp-http-agent-server";
import { UiAuthService } from "./auth.service.js";
import { AppRoutesController } from "./router/app.controller.js";
import { AuthRoutesController } from "./router/auth.controller.js";
import { ChatRoutesController } from "./router/chat.controller.js";
import { ConfigRoutesController } from "./router/config.controller.js";
import { CronRoutesController } from "./router/cron.controller.js";
import { NcpSessionRoutesController } from "./router/ncp-session.controller.js";
import {
  McpMarketplaceController,
  mountMarketplaceRoutes,
  normalizeMarketplaceBaseUrl,
  PluginMarketplaceController,
  SkillMarketplaceController
} from "./router/marketplace/index.js";
import { RemoteRoutesController } from "./router/remote.controller.js";
import { err } from "./router/response.js";
import { SessionRoutesController } from "./router/session.controller.js";
import type { UiRouterOptions } from "./router/types.js";

function registerAuthRoutes(app: Hono, authController: AuthRoutesController): void {
  app.get("/api/auth/status", authController.getStatus);
  app.post("/api/auth/setup", authController.setup);
  app.post("/api/auth/login", authController.login);
  app.post("/api/auth/logout", authController.logout);
  app.put("/api/auth/password", authController.updatePassword);
  app.put("/api/auth/enabled", authController.updateEnabled);
  app.post("/api/auth/bridge", authController.issueBridgeSession);
}

function registerConfigRoutes(app: Hono, configController: ConfigRoutesController): void {
  app.get("/api/config", configController.getConfig);
  app.get("/api/config/meta", configController.getConfigMeta);
  app.get("/api/config/schema", configController.getConfigSchema);
  app.put("/api/config/model", configController.updateConfigModel);
  app.put("/api/config/search", configController.updateConfigSearch);
  app.put("/api/config/providers/:provider", configController.updateProvider);
  app.post("/api/config/providers", configController.createProvider);
  app.delete("/api/config/providers/:provider", configController.deleteProvider);
  app.post("/api/config/providers/:provider/test", configController.testProviderConnection);
  app.post("/api/config/providers/:provider/auth/start", configController.startProviderAuth);
  app.post("/api/config/providers/:provider/auth/poll", configController.pollProviderAuth);
  app.post("/api/config/providers/:provider/auth/import-cli", configController.importProviderAuthFromCli);
  app.put("/api/config/channels/:channel", configController.updateChannel);
  app.put("/api/config/secrets", configController.updateSecrets);
  app.put("/api/config/runtime", configController.updateRuntime);
  app.post("/api/config/actions/:actionId/execute", configController.executeAction);
}

function registerChatRoutes(app: Hono, chatController: ChatRoutesController): void {
  app.get("/api/chat/capabilities", chatController.getCapabilities);
  app.get("/api/chat/session-types", chatController.getSessionTypes);
  app.get("/api/chat/commands", chatController.getCommands);
  app.post("/api/chat/turn", chatController.processTurn);
  app.post("/api/chat/turn/stop", chatController.stopTurn);
  app.post("/api/chat/turn/stream", chatController.streamTurn);
  app.get("/api/chat/runs", chatController.listRuns);
  app.get("/api/chat/runs/:runId", chatController.getRun);
  app.get("/api/chat/runs/:runId/stream", chatController.streamRun);
}

function registerSessionRoutes(app: Hono, sessionController: SessionRoutesController): void {
  app.get("/api/sessions", sessionController.listSessions);
  app.get("/api/sessions/:key/history", sessionController.getSessionHistory);
  app.put("/api/sessions/:key", sessionController.patchSession);
  app.delete("/api/sessions/:key", sessionController.deleteSession);
}

function registerNcpRoutes(
  app: Hono,
  options: UiRouterOptions,
  ncpSessionController: NcpSessionRoutesController
): void {
  if (!options.ncpAgent) {
    return;
  }

  mountNcpHttpAgentRoutes(app, {
    basePath: options.ncpAgent.basePath ?? "/api/ncp/agent",
    agentClientEndpoint: options.ncpAgent.agentClientEndpoint,
    streamProvider: options.ncpAgent.streamProvider
  });
  app.get("/api/ncp/session-types", ncpSessionController.getSessionTypes);
  app.get("/api/ncp/sessions", ncpSessionController.listSessions);
  app.get("/api/ncp/sessions/:sessionId", ncpSessionController.getSession);
  app.put("/api/ncp/sessions/:sessionId", ncpSessionController.patchSession);
  app.get("/api/ncp/sessions/:sessionId/messages", ncpSessionController.listSessionMessages);
  app.delete("/api/ncp/sessions/:sessionId", ncpSessionController.deleteSession);
}

function registerCronRoutes(app: Hono, cronController: CronRoutesController): void {
  app.get("/api/cron", cronController.listJobs);
  app.delete("/api/cron/:id", cronController.deleteJob);
  app.put("/api/cron/:id/enable", cronController.enableJob);
  app.post("/api/cron/:id/run", cronController.runJob);
}

function registerRemoteRoutes(app: Hono, remoteController: RemoteRoutesController | null): void {
  if (!remoteController) {
    return;
  }

  app.get("/api/remote/status", remoteController.getStatus);
  app.get("/api/remote/doctor", remoteController.getDoctor);
  app.post("/api/remote/login", remoteController.login);
  app.post("/api/remote/logout", remoteController.logout);
  app.put("/api/remote/settings", remoteController.updateSettings);
  app.post("/api/remote/service/:action", remoteController.controlService);
}

export function createUiRouter(options: UiRouterOptions): Hono {
  const app = new Hono();
  const marketplaceBaseUrl = normalizeMarketplaceBaseUrl(options);
  const authService = options.authService ?? new UiAuthService(options.configPath);

  const appController = new AppRoutesController(options);
  const authController = new AuthRoutesController(authService);
  const configController = new ConfigRoutesController(options);
  const chatController = new ChatRoutesController(options);
  const sessionController = new SessionRoutesController(options);
  const cronController = new CronRoutesController(options);
  const ncpSessionController = new NcpSessionRoutesController(options);
  const remoteController = options.remoteAccess ? new RemoteRoutesController(options.remoteAccess) : null;
  const pluginMarketplaceController = new PluginMarketplaceController(options, marketplaceBaseUrl);
  const skillMarketplaceController = new SkillMarketplaceController(options, marketplaceBaseUrl);
  const mcpMarketplaceController = new McpMarketplaceController(options, marketplaceBaseUrl);

  app.notFound((c) => c.json(err("NOT_FOUND", "endpoint not found"), 404));

  app.use("/api/*", async (c, next) => {
    const path = c.req.path;
    if (path === "/api/health" || path.startsWith("/api/auth/")) {
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

  app.get("/api/health", appController.health);
  app.get("/api/app/meta", appController.appMeta);
  registerAuthRoutes(app, authController);
  registerConfigRoutes(app, configController);
  registerChatRoutes(app, chatController);
  registerSessionRoutes(app, sessionController);
  registerNcpRoutes(app, options, ncpSessionController);
  registerCronRoutes(app, cronController);
  registerRemoteRoutes(app, remoteController);

  mountMarketplaceRoutes(app, {
    plugin: pluginMarketplaceController,
    skill: skillMarketplaceController,
    mcp: mcpMarketplaceController
  });

  return app;
}
