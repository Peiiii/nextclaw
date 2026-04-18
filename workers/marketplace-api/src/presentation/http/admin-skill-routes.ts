import type { Hono } from "hono";
import { ResourceNotFoundError } from "../../domain/errors";
import type { D1MarketplaceSkillDataSource } from "../../infrastructure/d1-data-source";
import { requireMarketplaceAdminAccess } from "./marketplace-auth";
import type { MarketplaceQueryParser } from "./query-parser";
import { ApiResponseFactory } from "./response";

type AdminSkillRouteBindings = {
  MARKETPLACE_SKILLS_DB: D1Database;
  MARKETPLACE_PLUGINS_DB: D1Database;
  MARKETPLACE_SKILLS_FILES: R2Bucket;
  MARKETPLACE_CACHE_TTL_SECONDS?: string;
  MARKETPLACE_ADMIN_TOKEN?: string;
  NEXTCLAW_PLATFORM_API_BASE?: string;
};

type AdminSkillRouteRuntime = {
  responses: ApiResponseFactory;
  parser: MarketplaceQueryParser;
  skillDataSource: D1MarketplaceSkillDataSource;
  invalidateCache: () => void;
};

export function registerAdminSkillRoutes(
  app: Hono<{ Bindings: AdminSkillRouteBindings }>,
  getRuntime: (bindings: AdminSkillRouteBindings) => AdminSkillRouteRuntime
): void {
  app.get("/api/v1/admin/skills/items", async (c) => {
    await requireMarketplaceAdminAccess(c);
    const runtime = getRuntime(c.env);
    const data = await runtime.skillDataSource.listAdminSkills(runtime.parser.parseAdminSkillListQuery(c));
    return runtime.responses.ok(c, data);
  });

  app.get("/api/v1/admin/skills/items/:selector", async (c) => {
    await requireMarketplaceAdminAccess(c);
    const runtime = getRuntime(c.env);
    const selector = c.req.param("selector");
    const payload = await runtime.skillDataSource.getAdminSkillDetail(selector);
    if (!payload) {
      throw new ResourceNotFoundError(`skill item not found: ${selector}`);
    }
    return runtime.responses.ok(c, payload);
  });

  app.post("/api/v1/admin/skills/upsert", async (c) => {
    await requireMarketplaceAdminAccess(c);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return runtimeResponseFactory.error(c, "INVALID_BODY", "invalid json body", 400);
    }

    const runtime = getRuntime(c.env);
    const result = await runtime.skillDataSource.upsertSkill(body, {
      authType: "admin_token",
      role: "admin",
      userId: null,
      username: "nextclaw"
    });
    runtime.invalidateCache();
    return runtime.responses.ok(c, {
      created: result.created,
      item: result.item,
      fileCount: result.fileCount
    });
  });

  app.post("/api/v1/admin/skills/review", async (c) => {
    await requireMarketplaceAdminAccess(c);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return runtimeResponseFactory.error(c, "INVALID_BODY", "invalid json body", 400);
    }

    const runtime = getRuntime(c.env);
    const item = await runtime.skillDataSource.reviewSkill(body);
    runtime.invalidateCache();
    return runtime.responses.ok(c, {
      item
    });
  });
}

const runtimeResponseFactory = new ApiResponseFactory();
