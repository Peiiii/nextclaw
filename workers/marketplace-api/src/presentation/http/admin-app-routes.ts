import type { Hono } from "hono";
import { ResourceNotFoundError } from "../../domain/errors";
import type { D1MarketplaceAppDataSource } from "../../infrastructure/apps/d1-marketplace-app.repository";
import { requireMarketplaceAdminAccess } from "./marketplace-auth";
import type { MarketplaceQueryParser } from "./query-parser";
import { ApiResponseFactory } from "./response";

type AdminAppRouteBindings = {
  MARKETPLACE_SKILLS_DB: D1Database;
  MARKETPLACE_PLUGINS_DB: D1Database;
  MARKETPLACE_SKILLS_FILES: R2Bucket;
  MARKETPLACE_CACHE_TTL_SECONDS?: string;
  MARKETPLACE_ADMIN_TOKEN?: string;
  NEXTCLAW_PLATFORM_API_BASE?: string;
};

type AdminAppRouteRuntime = {
  responses: ApiResponseFactory;
  parser: MarketplaceQueryParser;
  appDataSource: D1MarketplaceAppDataSource;
  invalidateCache: () => void;
};

export function registerAdminAppRoutes(
  app: Hono<{ Bindings: AdminAppRouteBindings }>,
  getRuntime: (bindings: AdminAppRouteBindings) => AdminAppRouteRuntime,
): void {
  app.get("/api/v1/admin/apps/items", async (c) => {
    await requireMarketplaceAdminAccess(c);
    const runtime = getRuntime(c.env);
    const data = await runtime.appDataSource.listAdminApps(runtime.parser.parseAdminAppListQuery(c));
    return runtime.responses.ok(c, data);
  });

  app.get("/api/v1/admin/apps/items/:selector", async (c) => {
    await requireMarketplaceAdminAccess(c);
    const runtime = getRuntime(c.env);
    const selector = c.req.param("selector");
    const data = await runtime.appDataSource.getAdminAppDetail(selector);
    if (!data) {
      throw new ResourceNotFoundError(`app item not found: ${selector}`);
    }
    return runtime.responses.ok(c, data);
  });

  app.post("/api/v1/admin/apps/review", async (c) => {
    await requireMarketplaceAdminAccess(c);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return runtimeResponseFactory.error(c, "INVALID_BODY", "invalid json body", 400);
    }
    const runtime = getRuntime(c.env);
    const item = await runtime.appDataSource.reviewApp(body);
    runtime.invalidateCache();
    return runtime.responses.ok(c, { item });
  });
}

const runtimeResponseFactory = new ApiResponseFactory();
