import { Hono } from "hono";
import { mountNcpHttpAgentRoutes } from "@nextclaw/ncp-http-agent-server";
import { UiAuthService } from "./auth.service.js";
import { AgentsRoutesController } from "./ui-routes/agents.controller.js";
import { AppRoutesController } from "./ui-routes/app.controller.js";
import { AuthRoutesController } from "./ui-routes/auth.controller.js";
import { ConfigRoutesController } from "./ui-routes/config.controller.js";
import { CronRoutesController } from "./ui-routes/cron.controller.js";
import { NcpAssetRoutesController } from "./ui-routes/ncp-attachment.controller.js";
import { NcpSessionRoutesController } from "./ui-routes/ncp-session.controller.js";
import {
  McpMarketplaceController,
  mountMarketplaceRoutes,
  normalizeMarketplaceBaseUrl,
  PluginMarketplaceController,
  SkillMarketplaceController
} from "./ui-routes/marketplace/index.js";
import { RemoteRoutesController } from "./ui-routes/remote.controller.js";
import { RuntimeControlRoutesController } from "./ui-routes/runtime-control.controller.js";
import { err } from "./ui-routes/response.js";
import { ServerPathRoutesController } from "./ui-routes/server-path.controller.js";
import type { UiRouterOptions } from "./ui-routes/types.js";

function registerAuthRoutes(app: Hono, authController: AuthRoutesController): void {
  app.get("/api/auth/status", authController.getStatus);
  app.post("/api/auth/setup", authController.setup);
  app.post("/api/auth/login", authController.login);
  app.post("/api/auth/logout", authController.logout);
  app.put("/api/auth/password", authController.updatePassword);
  app.put("/api/auth/enabled", authController.updateEnabled);
  app.post("/api/auth/bridge", authController.issueBridgeSession);
}

function registerAgentRoutes(app: Hono, agentsController: AgentsRoutesController): void {
  app.get("/api/agents", agentsController.listAgents);
  app.post("/api/agents", agentsController.createAgent);
  app.put("/api/agents/:agentId", agentsController.updateAgent);
  app.delete("/api/agents/:agentId", agentsController.deleteAgent);
  app.get("/api/agents/:agentId/avatar", agentsController.getAgentAvatar);
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
  app.post("/api/config/channels/:channel/auth/start", configController.startChannelAuth);
  app.post("/api/config/channels/:channel/auth/poll", configController.pollChannelAuth);
  app.put("/api/config/secrets", configController.updateSecrets);
  app.put("/api/config/runtime", configController.updateRuntime);
  app.post("/api/config/actions/:actionId/execute", configController.executeAction);
}

function registerNcpSessionRoutes(app: Hono, ncpSessionController: NcpSessionRoutesController): void {
  app.get("/api/ncp/session-types", ncpSessionController.getSessionTypes);
  app.get("/api/ncp/sessions", ncpSessionController.listSessions);
  app.get("/api/ncp/sessions/:sessionId", ncpSessionController.getSession);
  app.put("/api/ncp/sessions/:sessionId", ncpSessionController.patchSession);
  app.get("/api/ncp/sessions/:sessionId/messages", ncpSessionController.listSessionMessages);
  app.get("/api/ncp/sessions/:sessionId/skills", ncpSessionController.getSessionSkills);
  app.delete("/api/ncp/sessions/:sessionId", ncpSessionController.deleteSession);
}

function registerServerPathRoutes(app: Hono, serverPathController: ServerPathRoutesController): void {
  app.get("/api/server-paths/browse", serverPathController.browse);
}

function registerNcpRuntimeRoutes(
  app: Hono,
  options: UiRouterOptions,
  ncpAssetController: NcpAssetRoutesController,
): void {
  if (!options.ncpAgent) {
    return;
  }

  mountNcpHttpAgentRoutes(app, {
    basePath: options.ncpAgent.basePath ?? "/api/ncp/agent",
    agentClientEndpoint: options.ncpAgent.agentClientEndpoint,
    streamProvider: options.ncpAgent.streamProvider
  });
  app.post("/api/ncp/assets", ncpAssetController.putAssets);
  app.get("/api/ncp/assets/content", ncpAssetController.getAssetContent);
}

function registerCronRoutes(app: Hono, cronController: CronRoutesController): void {
  app.get("/api/cron", cronController.listJobs);
  app.post("/api/cron", cronController.createJob);
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
  app.post("/api/remote/auth/start", remoteController.startBrowserAuth);
  app.post("/api/remote/auth/poll", remoteController.pollBrowserAuth);
  app.post("/api/remote/logout", remoteController.logout);
  app.put("/api/remote/account/profile", remoteController.updateProfile);
  app.put("/api/remote/settings", remoteController.updateSettings);
  app.post("/api/remote/service/:action", remoteController.controlService);
}

function registerRuntimeControlRoutes(app: Hono, runtimeControlController: RuntimeControlRoutesController | null): void {
  if (!runtimeControlController) {
    return;
  }

  app.get("/api/runtime/control", runtimeControlController.getControl);
  app.post("/api/runtime/control/start-service", runtimeControlController.startService);
  app.post("/api/runtime/control/restart-service", runtimeControlController.restartService);
  app.post("/api/runtime/control/stop-service", runtimeControlController.stopService);
}

function createUiRouteControllers(
  options: UiRouterOptions,
  authService: UiAuthService,
  marketplaceBaseUrl: string
) {
  return {
    app: new AppRoutesController(options),
    agents: new AgentsRoutesController(options),
    auth: new AuthRoutesController(authService),
    config: new ConfigRoutesController(options),
    cron: new CronRoutesController(options),
    ncpSession: new NcpSessionRoutesController(options),
    ncpAsset: new NcpAssetRoutesController(options),
    serverPath: new ServerPathRoutesController(),
    remote: options.remoteAccess ? new RemoteRoutesController(options.remoteAccess) : null,
    runtimeControl: options.runtimeControl ? new RuntimeControlRoutesController(options.runtimeControl) : null,
    pluginMarketplace: new PluginMarketplaceController(options, marketplaceBaseUrl),
    skillMarketplace: new SkillMarketplaceController(options, marketplaceBaseUrl),
    mcpMarketplace: new McpMarketplaceController(options, marketplaceBaseUrl)
  };
}

export function createUiRouter(options: UiRouterOptions): Hono {
  const app = new Hono();
  const marketplaceBaseUrl = normalizeMarketplaceBaseUrl(options);
  const authService = options.authService ?? new UiAuthService(options.configPath);
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

  app.get("/api/health", controllers.app.health);
  app.get("/api/app/meta", controllers.app.appMeta);
  app.get("/api/runtime/bootstrap-status", controllers.app.bootstrapStatus);
  registerAuthRoutes(app, controllers.auth);
  registerAgentRoutes(app, controllers.agents);
  registerConfigRoutes(app, controllers.config);
  registerNcpSessionRoutes(app, controllers.ncpSession);
  registerServerPathRoutes(app, controllers.serverPath);
  registerNcpRuntimeRoutes(app, options, controllers.ncpAsset);
  registerCronRoutes(app, controllers.cron);
  registerRemoteRoutes(app, controllers.remote);
  registerRuntimeControlRoutes(app, controllers.runtimeControl);

  mountMarketplaceRoutes(app, {
    plugin: controllers.pluginMarketplace,
    skill: controllers.skillMarketplace,
    mcp: controllers.mcpMarketplace
  });

  return app;
}
