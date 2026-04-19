import type { Hono } from "hono";
import { ResourceNotFoundError } from "../../domain/errors";
import type { D1MarketplaceAppDataSource } from "../../infrastructure/apps/d1-marketplace-app.repository";
import { MarketplaceAuthError, resolvePublishActor } from "./marketplace-auth";
import { ApiResponseFactory } from "./response";

type UserAppRouteBindings = {
  MARKETPLACE_SKILLS_DB: D1Database;
  MARKETPLACE_PLUGINS_DB: D1Database;
  MARKETPLACE_SKILLS_FILES: R2Bucket;
  MARKETPLACE_CACHE_TTL_SECONDS?: string;
  MARKETPLACE_ADMIN_TOKEN?: string;
  NEXTCLAW_PLATFORM_API_BASE?: string;
};

type UserAppRouteRuntime = {
  responses: ApiResponseFactory;
  appDataSource: D1MarketplaceAppDataSource;
  invalidateCache: () => void;
};

export function registerUserAppRoutes(
  app: Hono<{ Bindings: UserAppRouteBindings }>,
  getRuntime: (bindings: UserAppRouteBindings) => UserAppRouteRuntime,
): void {
  app.get("/api/v1/user/apps/items", async (c) => {
    const runtime = getRuntime(c.env);
    const actor = await resolvePlatformUser(c);
    const data = await runtime.appDataSource.listOwnerApps({
      ownerUserId: actor.userId,
      q: c.req.query("q")?.trim() || undefined,
    });
    return runtime.responses.ok(c, data);
  });

  app.get("/api/v1/user/apps/items/:selector", async (c) => {
    const runtime = getRuntime(c.env);
    const actor = await resolvePlatformUser(c);
    const selector = c.req.param("selector");
    const data = await runtime.appDataSource.getOwnerAppDetail(selector, actor.userId);
    if (!data) {
      throw new ResourceNotFoundError(`app item not found: ${selector}`);
    }
    return runtime.responses.ok(c, data);
  });

  app.post("/api/v1/user/apps/manage", async (c) => {
    const runtime = getRuntime(c.env);
    const actor = await resolvePlatformUser(c);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return runtimeResponseFactory.error(c, "INVALID_BODY", "invalid json body", 400);
    }
    if (typeof body !== "object" || !body) {
      return runtimeResponseFactory.error(c, "INVALID_BODY", "body must be an object", 400);
    }
    const selector = "selector" in body && typeof body.selector === "string" ? body.selector.trim() : "";
    const action = "action" in body && typeof body.action === "string" ? body.action.trim() : "";
    if (!selector || (action !== "hide" && action !== "show" && action !== "delete")) {
      return runtimeResponseFactory.error(c, "INVALID_BODY", "selector and valid action are required", 400);
    }
    const item = await runtime.appDataSource.manageOwnerApp({
      selector,
      ownerUserId: actor.userId,
      action,
    });
    runtime.invalidateCache();
    return runtime.responses.ok(c, { item });
  });
}

async function resolvePlatformUser(c: { req: { header(name: string): string | undefined } }): Promise<{ userId: string }> {
  const actor = await resolvePublishActor(c as never);
  if (actor.authType !== "platform_user" || !actor.userId) {
    throw new MarketplaceAuthError("platform user token required");
  }
  return {
    userId: actor.userId,
  };
}

const runtimeResponseFactory = new ApiResponseFactory();
