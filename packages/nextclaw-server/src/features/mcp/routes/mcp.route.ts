import type { Hono } from "hono";
import type { McpRoutesController } from "@nextclaw-server/features/mcp/controllers/mcp.controller.js";

export function mountMcpRoutes(app: Hono, controller: McpRoutesController): void {
  app.post("/api/mcp/servers/test", controller.testConnection);
  app.post("/api/mcp/servers", controller.createConnection);
}
