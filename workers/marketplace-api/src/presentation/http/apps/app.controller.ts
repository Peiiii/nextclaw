import type { Hono } from "hono";
import { ResourceNotFoundError } from "../../../domain/errors";
import type { D1MarketplaceAppDataSource } from "../../../infrastructure/apps/d1-marketplace-app.repository";
import { resolvePublishActor } from "../marketplace-auth";
import type { MarketplaceQueryParser } from "../query-parser";
import { ApiResponseFactory } from "../response";

type AppRouteBindings = {
  MARKETPLACE_SKILLS_DB: D1Database;
  MARKETPLACE_PLUGINS_DB: D1Database;
  MARKETPLACE_SKILLS_FILES: R2Bucket;
  MARKETPLACE_CACHE_TTL_SECONDS?: string;
  MARKETPLACE_ADMIN_TOKEN?: string;
  NEXTCLAW_PLATFORM_API_BASE?: string;
};

type AppRouteRuntime = {
  responses: ApiResponseFactory;
  parser: MarketplaceQueryParser;
  appDataSource: D1MarketplaceAppDataSource;
  invalidateCache: () => void;
};

export function registerAppRoutes(
  app: Hono<{ Bindings: AppRouteBindings }>,
  getRuntime: (bindings: AppRouteBindings) => AppRouteRuntime,
): void {
  app.get("/api/v1/apps/items", async (c) => {
    const runtime = getRuntime(c.env);
    const data = await runtime.appDataSource.listApps(runtime.parser.parseListQuery(c));
    return runtime.responses.ok(c, data);
  });

  app.get("/api/v1/apps/items/:selector", async (c) => {
    const runtime = getRuntime(c.env);
    const selector = c.req.param("selector");
    const data = await runtime.appDataSource.getAppDetail(selector);
    if (!data) {
      throw new ResourceNotFoundError(`app item not found: ${selector}`);
    }
    return runtime.responses.ok(c, data);
  });

  app.get("/api/v1/apps/items/:selector/files", async (c) => {
    const runtime = getRuntime(c.env);
    const selector = c.req.param("selector");
    const data = await runtime.appDataSource.getAppFiles(selector);
    if (!data) {
      throw new ResourceNotFoundError(`app item not found: ${selector}`);
    }
    return runtime.responses.ok(c, data);
  });

  app.get("/api/v1/apps/items/:selector/files/blob", async (c) => {
    const runtime = getRuntime(c.env);
    const selector = c.req.param("selector");
    const filePath = c.req.query("path");
    if (!filePath) {
      return runtime.responses.error(c, "INVALID_QUERY", "query.path is required", 400);
    }
    const payload = await runtime.appDataSource.getAppFileContent(selector, filePath);
    if (!payload) {
      throw new ResourceNotFoundError(`app file not found: ${selector}/${filePath}`);
    }
    return new Response(payload.object.body, {
      status: 200,
      headers: {
        "content-type": payload.file.content_type,
        "cache-control": "public, max-age=300",
        "x-app-file-sha256": payload.file.sha256,
      },
    });
  });

  app.get("/api/v1/apps/items/:selector/bundles/:version", async (c) => {
    const runtime = getRuntime(c.env);
    const selector = c.req.param("selector");
    const version = c.req.param("version");
    const payload = await runtime.appDataSource.getBundle(selector, version);
    if (!payload) {
      throw new ResourceNotFoundError(`app bundle not found: ${selector}@${version}`);
    }
    return new Response(payload.object.body, {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${payload.item.slug}-${version}.napp`)}`,
        "cache-control": "public, max-age=300",
        "x-app-bundle-sha256": payload.version.bundle_sha256,
      },
    });
  });

  app.get("/api/v1/apps/registry/:appId", async (c) => {
    const runtime = getRuntime(c.env);
    const appId = c.req.param("appId");
    const data = await runtime.appDataSource.getRegistryDocument(appId);
    if (!data) {
      throw new ResourceNotFoundError(`app registry document not found: ${appId}`);
    }
    return c.json(data);
  });

  app.post("/api/v1/apps/publish", async (c) => {
    const actor = await resolvePublishActor(c);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return runtimeResponseFactory.error(c, "INVALID_BODY", "invalid json body", 400);
    }
    const runtime = getRuntime(c.env);
    const data = await runtime.appDataSource.publishApp(body, actor);
    runtime.invalidateCache();
    return runtime.responses.ok(c, data);
  });
}

const runtimeResponseFactory = new ApiResponseFactory();
