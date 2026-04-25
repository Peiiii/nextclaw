import { Hono } from "hono";
import { GetMcpItemUseCase } from "./application/mcp/get-mcp-item.usecase";
import { ListMcpItemsUseCase } from "./application/mcp/list-mcp-items.usecase";
import { ListMcpRecommendationsUseCase } from "./application/mcp/list-mcp-recommendations.usecase";
import { GetPluginItemUseCase } from "./application/plugins/get-plugin-item.usecase";
import { ListPluginItemsUseCase } from "./application/plugins/list-plugin-items.usecase";
import { ListPluginRecommendationsUseCase } from "./application/plugins/list-plugin-recommendations.usecase";
import { GetSkillItemUseCase } from "./application/skills/get-skill-item.usecase";
import { ListSkillItemsUseCase } from "./application/skills/list-skill-items.usecase";
import { ListSkillRecommendationsUseCase } from "./application/skills/list-skill-recommendations.usecase";
import { DomainValidationError, ResourceNotFoundError } from "./domain/errors";
import { D1MarketplaceAppDataSource } from "./infrastructure/apps/d1-marketplace-app.repository";
import {
  D1MarketplacePluginDataSource,
  D1MarketplaceSkillDataSource,
} from "./infrastructure/d1-data-source";
import { D1MarketplaceMcpDataSource } from "./infrastructure/d1-mcp-data-source";
import { InMemoryMcpRepository } from "./infrastructure/in-memory-mcp.repository";
import { InMemoryPluginRepository } from "./infrastructure/in-memory-plugin.repository";
import { InMemorySkillRepository } from "./infrastructure/in-memory-skill.repository";
import { ensureMcpItem, ensureSkillItem } from "./presentation/http/marketplace-assertions";
import { registerAdminAppRoutes } from "./presentation/http/admin-app-routes";
import { registerAdminSkillRoutes } from "./presentation/http/admin-skill-routes";
import { registerAppRoutes } from "./presentation/http/apps/app.controller";
import { decodeUtf8, splitMarkdownFrontmatter } from "./presentation/http/marketplace-content";
import { MarketplaceAuthError, resolvePublishActor } from "./presentation/http/marketplace-auth";
import { MarketplaceQueryParser } from "./presentation/http/query-parser";
import { ApiResponseFactory } from "./presentation/http/response";
import { registerUserAppRoutes } from "./presentation/http/user-app-routes";
import { registerUserSkillRoutes } from "./presentation/http/user-skill-routes";

type MarketplaceBindings = {
  MARKETPLACE_SKILLS_DB: D1Database;
  MARKETPLACE_PLUGINS_DB: D1Database;
  MARKETPLACE_SKILLS_FILES: R2Bucket;
  MARKETPLACE_CACHE_TTL_SECONDS?: string;
  MARKETPLACE_ADMIN_TOKEN?: string;
  NEXTCLAW_PLATFORM_API_BASE?: string;
};

type MarketplaceEnv = {
  Bindings: MarketplaceBindings;
};

class MarketplaceRuntime {
  readonly responses = new ApiResponseFactory();
  readonly parser = new MarketplaceQueryParser();
  readonly pluginDataSource: D1MarketplacePluginDataSource;
  readonly skillDataSource: D1MarketplaceSkillDataSource;
  readonly mcpDataSource: D1MarketplaceMcpDataSource;
  readonly appDataSource: D1MarketplaceAppDataSource;

  readonly pluginRepository: InMemoryPluginRepository;
  readonly listPluginItems: ListPluginItemsUseCase;
  readonly getPluginItem: GetPluginItemUseCase;
  readonly listPluginRecommendations: ListPluginRecommendationsUseCase;

  readonly skillRepository: InMemorySkillRepository;
  readonly listSkillItems: ListSkillItemsUseCase;
  readonly getSkillItem: GetSkillItemUseCase;
  readonly listSkillRecommendations: ListSkillRecommendationsUseCase;

  readonly mcpRepository: InMemoryMcpRepository;
  readonly listMcpItems: ListMcpItemsUseCase;
  readonly getMcpItem: GetMcpItemUseCase;
  readonly listMcpRecommendations: ListMcpRecommendationsUseCase;

  constructor(bindings: MarketplaceBindings) {
    this.pluginDataSource = new D1MarketplacePluginDataSource(bindings.MARKETPLACE_PLUGINS_DB);
    this.skillDataSource = new D1MarketplaceSkillDataSource(bindings.MARKETPLACE_SKILLS_DB, bindings.MARKETPLACE_SKILLS_FILES);
    this.mcpDataSource = new D1MarketplaceMcpDataSource(bindings.MARKETPLACE_PLUGINS_DB);
    this.appDataSource = new D1MarketplaceAppDataSource(bindings.MARKETPLACE_SKILLS_DB, bindings.MARKETPLACE_SKILLS_FILES);
    const ttlSeconds = this.parseCacheTtlSeconds(bindings.MARKETPLACE_CACHE_TTL_SECONDS);

    this.pluginRepository = new InMemoryPluginRepository(this.pluginDataSource, {
      cacheTtlMs: ttlSeconds * 1000
    });
    this.listPluginItems = new ListPluginItemsUseCase(this.pluginRepository);
    this.getPluginItem = new GetPluginItemUseCase(this.pluginRepository);
    this.listPluginRecommendations = new ListPluginRecommendationsUseCase(this.pluginRepository);

    this.skillRepository = new InMemorySkillRepository(this.skillDataSource, {
      cacheTtlMs: ttlSeconds * 1000
    });
    this.listSkillItems = new ListSkillItemsUseCase(this.skillRepository);
    this.getSkillItem = new GetSkillItemUseCase(this.skillRepository);
    this.listSkillRecommendations = new ListSkillRecommendationsUseCase(this.skillRepository);

    this.mcpRepository = new InMemoryMcpRepository(this.mcpDataSource, {
      cacheTtlMs: ttlSeconds * 1000
    });
    this.listMcpItems = new ListMcpItemsUseCase(this.mcpRepository);
    this.getMcpItem = new GetMcpItemUseCase(this.mcpRepository);
    this.listMcpRecommendations = new ListMcpRecommendationsUseCase(this.mcpRepository);
  }

  invalidateCache(): void {
    this.pluginRepository.invalidateCache();
    this.skillRepository.invalidateCache();
    this.mcpRepository.invalidateCache();
  }

  private parseCacheTtlSeconds(raw: string | undefined): number {
    if (!raw) {
      return 5;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 5;
    }
    return parsed;
  }
}

const responses = new ApiResponseFactory();
const runtimes = new WeakMap<D1Database, WeakMap<D1Database, MarketplaceRuntime>>();

function getRuntime(bindings: MarketplaceBindings): MarketplaceRuntime {
  if (!bindings.MARKETPLACE_PLUGINS_DB) {
    throw new Error("MARKETPLACE_PLUGINS_DB binding is required");
  }
  if (!bindings.MARKETPLACE_SKILLS_DB) {
    throw new Error("MARKETPLACE_SKILLS_DB binding is required");
  }
  if (!bindings.MARKETPLACE_SKILLS_FILES) {
    throw new Error("MARKETPLACE_SKILLS_FILES binding is required");
  }
  const pluginDb = bindings.MARKETPLACE_PLUGINS_DB;
  const skillDb = bindings.MARKETPLACE_SKILLS_DB;
  let bySkill = runtimes.get(pluginDb);
  if (!bySkill) {
    bySkill = new WeakMap();
    runtimes.set(pluginDb, bySkill);
  }
  const cached = bySkill.get(skillDb);
  if (cached) {
    return cached;
  }
  const created = new MarketplaceRuntime(bindings);
  bySkill.set(skillDb, created);
  return created;
}

const app = new Hono<MarketplaceEnv>();
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
};

app.use("*", async (c, next) => {
  if (c.req.method.toUpperCase() === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }
  await next();
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });
  return c.res;
});

app.notFound((c) => responses.error(c, "NOT_FOUND", "endpoint not found", 404));

app.onError((error, c) => {
  if (error instanceof ResourceNotFoundError) {
    return responses.error(c, "NOT_FOUND", error.message, 404);
  }

  if (error instanceof DomainValidationError) {
    return responses.error(c, "INVALID_QUERY", error.message, 400);
  }

  if (error instanceof MarketplaceAuthError) {
    return responses.error(c, "UNAUTHORIZED", error.message, 401);
  }

  return responses.error(c, "INTERNAL_ERROR", error.message || "internal error", 500);
});

app.use("/api/v1/*", async (c, next) => {
  const method = c.req.method.toUpperCase();
  const path = c.req.path;
  const isRead = method === "GET" || method === "HEAD";
  const isAdminWrite = method === "POST" && path.startsWith("/api/v1/admin/");
  const isSkillPublish = method === "POST" && path === "/api/v1/skills/publish";
  const isAppPublish = method === "POST" && path === "/api/v1/apps/publish";
  const isOwnerManage =
    method === "POST" &&
    (path === "/api/v1/user/skills/manage" || path === "/api/v1/user/apps/manage");

  if (!isRead && !isAdminWrite && !isSkillPublish && !isAppPublish && !isOwnerManage) {
    return responses.error(c, "READ_ONLY_API", "marketplace api is read-only except publish/admin routes", 405);
  }

  await next();
  return undefined;
});

app.get("/health", (c) => {
  return responses.ok(c, {
    status: "ok",
    service: "marketplace-api",
    storage: "d1+r2",
    databases: ["skills", "plugins", "apps"]
  });
});

app.get("/api/v1/plugins/items", async (c) => {
  const runtime = getRuntime(c.env);
  const query = runtime.parser.parseListQuery(c);
  const data = await runtime.listPluginItems.execute(query);
  return runtime.responses.ok(c, data);
});

app.get("/api/v1/plugins/items/:slug", async (c) => {
  const runtime = getRuntime(c.env);
  const data = await runtime.getPluginItem.execute(c.req.param("slug"));
  return runtime.responses.ok(c, data);
});

app.get("/api/v1/plugins/recommendations", async (c) => {
  const runtime = getRuntime(c.env);
  const sceneId = runtime.parser.parseRecommendationScene(c);
  const limit = runtime.parser.parseRecommendationLimit(c);
  const data = await runtime.listPluginRecommendations.execute(sceneId, limit);
  return runtime.responses.ok(c, data);
});

app.get("/api/v1/skills/items", async (c) => {
  const runtime = getRuntime(c.env);
  const query = runtime.parser.parseListQuery(c);
  const data = await runtime.listSkillItems.execute(query);
  return runtime.responses.ok(c, data);
});

app.get("/api/v1/skills/items/:slug", async (c) => {
  const runtime = getRuntime(c.env);
  const data = await runtime.getSkillItem.execute(c.req.param("slug"));
  return runtime.responses.ok(c, data);
});

app.get("/api/v1/skills/items/:slug/files", async (c) => {
  const runtime = getRuntime(c.env);
  const slug = c.req.param("slug");
  const payload = await runtime.skillDataSource.getSkillFilesBySlug(slug);
  if (!payload) {
    throw new ResourceNotFoundError(`skill item not found: ${slug}`);
  }
  ensureSkillItem(payload.item);

  return runtime.responses.ok(c, {
    type: "skill",
    slug: payload.item.slug,
    packageName: payload.item.packageName,
    install: payload.item.install,
    updatedAt: payload.item.updatedAt,
    totalFiles: payload.files.length,
    files: payload.files.map((file) => ({
      ...file,
      downloadPath: `/api/v1/skills/items/${encodeURIComponent(payload.item.slug)}/files/blob?path=${encodeURIComponent(file.path)}`
    }))
  });
});

app.get("/api/v1/skills/items/:slug/files/blob", async (c) => {
  const runtime = getRuntime(c.env);
  const slug = c.req.param("slug");
  const path = c.req.query("path");
  if (!path) {
    throw new DomainValidationError("query.path is required");
  }
  const payload = await runtime.skillDataSource.getSkillFileContentBySlug(slug, path);
  if (!payload) {
    throw new ResourceNotFoundError(`skill file not found: ${slug}/${path}`);
  }
  ensureSkillItem(payload.item);

  const filename = payload.file.path.split("/").pop() ?? "file";
  return new Response(payload.bytes, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "x-skill-file-sha256": payload.file.sha256
    }
  });
});

app.get("/api/v1/skills/items/:slug/content", async (c) => {
  const runtime = getRuntime(c.env);
  const slug = c.req.param("slug");
  const payload = await runtime.skillDataSource.getSkillFileContentBySlug(slug, "SKILL.md")
    ?? await runtime.skillDataSource.getSkillFileContentBySlug(slug, "skill.md");
  if (!payload) {
    throw new ResourceNotFoundError(`skill item not found: ${slug}`);
  }
  ensureSkillItem(payload.item);

  const raw = decodeUtf8(payload.bytes);

  const split = splitMarkdownFrontmatter(raw);
  return runtime.responses.ok(c, {
    type: "skill",
    slug: payload.item.slug,
    packageName: payload.item.packageName,
    name: payload.item.name,
    install: payload.item.install,
    source: payload.item.install.kind,
    raw,
    metadataRaw: split.metadataRaw,
    bodyRaw: split.bodyRaw
  });
});

app.get("/api/v1/skills/recommendations", async (c) => {
  const runtime = getRuntime(c.env);
  const sceneId = runtime.parser.parseRecommendationScene(c);
  const limit = runtime.parser.parseRecommendationLimit(c);
  const data = await runtime.listSkillRecommendations.execute(sceneId, limit);
  return runtime.responses.ok(c, data);
});

app.get("/api/v1/mcp/items", async (c) => {
  const runtime = getRuntime(c.env);
  const query = runtime.parser.parseListQuery(c);
  const data = await runtime.listMcpItems.execute(query);
  return runtime.responses.ok(c, data);
});

app.get("/api/v1/mcp/items/:slug", async (c) => {
  const runtime = getRuntime(c.env);
  const data = await runtime.getMcpItem.execute(c.req.param("slug"));
  return runtime.responses.ok(c, data);
});

app.get("/api/v1/mcp/items/:slug/content", async (c) => {
  const runtime = getRuntime(c.env);
  const item = await runtime.getMcpItem.execute(c.req.param("slug"));
  ensureMcpItem(item);
  const split = splitMarkdownFrontmatter(item.contentMarkdown);
  return runtime.responses.ok(c, {
    type: "mcp",
    slug: item.slug,
    name: item.name,
    install: item.install,
    source: "marketplace",
    raw: item.contentMarkdown,
    metadataRaw: split.metadataRaw,
    bodyRaw: split.bodyRaw,
    sourceUrl: item.contentSourceUrl
  });
});

app.get("/api/v1/mcp/recommendations", async (c) => {
  const runtime = getRuntime(c.env);
  const sceneId = runtime.parser.parseRecommendationScene(c);
  const limit = runtime.parser.parseRecommendationLimit(c);
  const data = await runtime.listMcpRecommendations.execute(sceneId, limit);
  return runtime.responses.ok(c, data);
});

app.post("/api/v1/skills/publish", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return responses.error(c, "INVALID_BODY", "invalid json body", 400);
  }

  const runtime = getRuntime(c.env);
  const actor = await resolvePublishActor(c);
  const result = await runtime.skillDataSource.upsertSkill(body, actor);
  runtime.invalidateCache();
  return runtime.responses.ok(c, {
    created: result.created,
    item: result.item,
    fileCount: result.fileCount
  });
});

registerAdminSkillRoutes(app, getRuntime);
registerAdminAppRoutes(app, getRuntime);
registerAppRoutes(app, getRuntime);
registerUserSkillRoutes(app, getRuntime);
registerUserAppRoutes(app, getRuntime);

export default app;
