import type { Context } from "hono";
import type {
  MarketplaceListView,
  MarketplaceItemView,
  MarketplacePluginContentView,
  MarketplacePluginInstallRequest,
  MarketplacePluginInstallResult,
  MarketplacePluginManageRequest,
  MarketplacePluginManageResult,
  MarketplaceRecommendationView
} from "../../types.js";
import { err, isRecord, ok, readJson } from "../response.js";
import type { UiRouterOptions } from "../types.js";
import {
  fetchMarketplaceData,
  normalizeMarketplaceItemForUi,
  sanitizeMarketplaceItemView,
  sanitizeMarketplaceListItems
} from "./catalog.js";
import {
  collectPluginMarketplaceInstalledView,
  isSupportedMarketplacePluginItem,
  resolvePluginManageTargetId
} from "./installed.js";

async function loadPluginReadmeFromNpm(spec: string): Promise<{ readme: string; sourceUrl: string; metadataRaw?: string } | null> {
  const encodedSpec = encodeURIComponent(spec);
  const registryUrl = `https://registry.npmjs.org/${encodedSpec}`;
  try {
    const response = await fetch(registryUrl, {
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const readme = typeof payload.readme === "string" ? payload.readme : "";
    const latest = isRecord(payload["dist-tags"]) && typeof payload["dist-tags"].latest === "string"
      ? payload["dist-tags"].latest
      : undefined;
    const metadata = {
      name: typeof payload.name === "string" ? payload.name : spec,
      version: latest,
      description: typeof payload.description === "string" ? payload.description : undefined,
      homepage: typeof payload.homepage === "string" ? payload.homepage : undefined
    };

    if (readme.trim().length === 0) {
      return null;
    }

    return {
      readme,
      sourceUrl: registryUrl,
      metadataRaw: JSON.stringify(metadata, null, 2)
    };
  } catch {
    return null;
  }
}

async function buildPluginContentView(item: MarketplaceItemView): Promise<MarketplacePluginContentView> {
  if (item.install.kind === "npm") {
    const npm = await loadPluginReadmeFromNpm(item.install.spec);
    if (npm) {
      return {
        type: "plugin",
        slug: item.slug,
        name: item.name,
        install: item.install,
        source: "npm",
        raw: npm.readme,
        bodyRaw: npm.readme,
        metadataRaw: npm.metadataRaw,
        sourceUrl: npm.sourceUrl
      };
    }
  }

  return {
    type: "plugin",
    slug: item.slug,
    name: item.name,
    install: item.install,
    source: "remote",
    bodyRaw: item.description || item.summary || "",
    metadataRaw: JSON.stringify({
      name: item.name,
      author: item.author,
      sourceRepo: item.sourceRepo,
      homepage: item.homepage
    }, null, 2)
  };
}

async function installMarketplacePlugin(params: {
  options: UiRouterOptions;
  body: MarketplacePluginInstallRequest;
}): Promise<MarketplacePluginInstallResult> {
  const spec = typeof params.body.spec === "string" ? params.body.spec.trim() : "";
  if (!spec) {
    throw new Error("INVALID_BODY:non-empty spec is required");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }

  if (!installer.installPlugin) {
    throw new Error("NOT_AVAILABLE:plugin installer is not configured");
  }
  const result = await installer.installPlugin(spec);

  params.options.publish({ type: "config.updated", payload: { path: "plugins" } });
  return {
    type: "plugin",
    spec,
    message: result.message,
    output: result.output
  };
}

async function manageMarketplacePlugin(params: {
  options: UiRouterOptions;
  body: MarketplacePluginManageRequest;
}): Promise<MarketplacePluginManageResult> {
  const action = params.body.action;
  const requestedTargetId = typeof params.body.id === "string" && params.body.id.trim().length > 0
    ? params.body.id.trim()
    : typeof params.body.spec === "string" && params.body.spec.trim().length > 0
      ? params.body.spec.trim()
      : "";

  const rawSpec = typeof params.body.spec === "string" ? params.body.spec.trim() : "";
  const targetId = resolvePluginManageTargetId(params.options, requestedTargetId, rawSpec);

  if ((action !== "enable" && action !== "disable" && action !== "uninstall") || !targetId) {
    throw new Error("INVALID_BODY:action and non-empty id/spec are required");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }

  let result: { message: string; output?: string };

  if (action === "enable") {
    if (!installer.enablePlugin) {
      throw new Error("NOT_AVAILABLE:plugin enable is not configured");
    }
    result = await installer.enablePlugin(targetId);
  } else if (action === "disable") {
    if (!installer.disablePlugin) {
      throw new Error("NOT_AVAILABLE:plugin disable is not configured");
    }
    result = await installer.disablePlugin(targetId);
  } else {
    if (!installer.uninstallPlugin) {
      throw new Error("NOT_AVAILABLE:plugin uninstall is not configured");
    }
    result = await installer.uninstallPlugin(targetId);
  }

  params.options.publish({ type: "config.updated", payload: { path: "plugins" } });

  return {
    type: "plugin",
    action,
    id: targetId,
    message: result.message,
    output: result.output
  };
}

export class PluginMarketplaceController {
  constructor(
    private readonly options: UiRouterOptions,
    private readonly marketplaceBaseUrl: string
  ) {}

  readonly getInstalled = (c: Context) => {
    return c.json(ok(collectPluginMarketplaceInstalledView(this.options)));
  };

  readonly listItems = async (c: Context) => {
    const query = c.req.query();
    const result = await fetchMarketplaceData<MarketplaceListView>({
      baseUrl: this.marketplaceBaseUrl,
      path: "/api/v1/plugins/items",
      query: {
        q: query.q,
        tag: query.tag,
        sort: query.sort,
        page: query.page,
        pageSize: query.pageSize
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const items = sanitizeMarketplaceListItems(result.data.items)
      .map((item) => normalizeMarketplaceItemForUi(item))
      .filter((item) => isSupportedMarketplacePluginItem(item));

    return c.json(ok({
      total: result.data.total,
      page: result.data.page,
      pageSize: result.data.pageSize,
      totalPages: result.data.totalPages,
      sort: result.data.sort,
      query: result.data.query,
      items
    }));
  };

  readonly getItem = async (c: Context) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: this.marketplaceBaseUrl,
      path: `/api/v1/plugins/items/${slug}`
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const sanitized = normalizeMarketplaceItemForUi(sanitizeMarketplaceItemView(result.data));
    if (!isSupportedMarketplacePluginItem(sanitized)) {
      return c.json(err("NOT_FOUND", "marketplace item not supported by nextclaw"), 404);
    }

    return c.json(ok(sanitized));
  };

  readonly getItemContent = async (c: Context) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: this.marketplaceBaseUrl,
      path: `/api/v1/plugins/items/${slug}`
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const sanitized = normalizeMarketplaceItemForUi(sanitizeMarketplaceItemView(result.data));
    if (!isSupportedMarketplacePluginItem(sanitized)) {
      return c.json(err("NOT_FOUND", "marketplace item not supported by nextclaw"), 404);
    }

    const content = await buildPluginContentView(sanitized);
    return c.json(ok(content));
  };

  readonly install = async (c: Context) => {
    const body = await readJson<MarketplacePluginInstallRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "plugin") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    try {
      const payload = await installMarketplacePlugin({
        options: this.options,
        body: body.data
      });
      return c.json(ok(payload));
    } catch (error) {
      const message = String(error);
      if (message.startsWith("INVALID_BODY:")) {
        return c.json(err("INVALID_BODY", message.slice("INVALID_BODY:".length)), 400);
      }
      if (message.startsWith("NOT_AVAILABLE:")) {
        return c.json(err("NOT_AVAILABLE", message.slice("NOT_AVAILABLE:".length)), 503);
      }
      return c.json(err("INSTALL_FAILED", message), 400);
    }
  };

  readonly manage = async (c: Context) => {
    const body = await readJson<MarketplacePluginManageRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "plugin") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    try {
      const payload = await manageMarketplacePlugin({
        options: this.options,
        body: body.data
      });
      return c.json(ok(payload));
    } catch (error) {
      const message = String(error);
      if (message.startsWith("INVALID_BODY:")) {
        return c.json(err("INVALID_BODY", message.slice("INVALID_BODY:".length)), 400);
      }
      if (message.startsWith("NOT_AVAILABLE:")) {
        return c.json(err("NOT_AVAILABLE", message.slice("NOT_AVAILABLE:".length)), 503);
      }
      return c.json(err("MANAGE_FAILED", message), 400);
    }
  };

  readonly getRecommendations = async (c: Context) => {
    const query = c.req.query();
    const result = await fetchMarketplaceData<MarketplaceRecommendationView>({
      baseUrl: this.marketplaceBaseUrl,
      path: "/api/v1/plugins/recommendations",
      query: {
        scene: query.scene,
        limit: query.limit
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const filteredItems = sanitizeMarketplaceListItems(result.data.items)
      .map((item) => normalizeMarketplaceItemForUi(item))
      .filter((item) => isSupportedMarketplacePluginItem(item));

    return c.json(ok({
      ...result.data,
      total: filteredItems.length,
      items: filteredItems
    }));
  };
}
