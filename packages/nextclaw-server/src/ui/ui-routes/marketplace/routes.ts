import type { Hono } from "hono";
import type { McpMarketplaceController } from "./mcp.controller.js";
import type { PluginMarketplaceController } from "./plugin.controller.js";
import type { SkillMarketplaceController } from "./skill.controller.js";

export function mountMarketplaceRoutes(
  app: Hono,
  controllers: {
    plugin: PluginMarketplaceController;
    skill: SkillMarketplaceController;
    mcp: McpMarketplaceController;
  }
): void {
  app.get("/api/marketplace/plugins/installed", controllers.plugin.getInstalled);
  app.get("/api/marketplace/plugins/items", controllers.plugin.listItems);
  app.get("/api/marketplace/plugins/items/:slug", controllers.plugin.getItem);
  app.get("/api/marketplace/plugins/items/:slug/content", controllers.plugin.getItemContent);
  app.post("/api/marketplace/plugins/install", controllers.plugin.install);
  app.post("/api/marketplace/plugins/manage", controllers.plugin.manage);
  app.get("/api/marketplace/plugins/recommendations", controllers.plugin.getRecommendations);

  app.get("/api/marketplace/skills/installed", controllers.skill.getInstalled);
  app.get("/api/marketplace/skills/items", controllers.skill.listItems);
  app.get("/api/marketplace/skills/items/:slug", controllers.skill.getItem);
  app.get("/api/marketplace/skills/items/:slug/content", controllers.skill.getItemContent);
  app.post("/api/marketplace/skills/install", controllers.skill.install);
  app.post("/api/marketplace/skills/manage", controllers.skill.manage);
  app.get("/api/marketplace/skills/recommendations", controllers.skill.getRecommendations);

  app.get("/api/marketplace/mcp/installed", controllers.mcp.getInstalled);
  app.get("/api/marketplace/mcp/items", controllers.mcp.listItems);
  app.get("/api/marketplace/mcp/items/:slug", controllers.mcp.getItem);
  app.get("/api/marketplace/mcp/items/:slug/content", controllers.mcp.getItemContent);
  app.post("/api/marketplace/mcp/install", controllers.mcp.install);
  app.post("/api/marketplace/mcp/manage", controllers.mcp.manage);
  app.post("/api/marketplace/mcp/doctor", controllers.mcp.doctor);
  app.get("/api/marketplace/mcp/recommendations", controllers.mcp.getRecommendations);
}
