import type { Context } from "hono";
import type {
  MarketplaceItemView,
  MarketplaceRecommendationView,
  MarketplaceSkillContentView,
  MarketplaceSkillInstallRequest,
  MarketplaceSkillInstallResult,
  MarketplaceSkillManageRequest,
  MarketplaceSkillManageResult
} from "../../types.js";
import { err, ok, readJson } from "../response.js";
import type { UiRouterOptions } from "../types.js";
import {
  fetchAllSkillMarketplaceItems,
  fetchMarketplaceData,
  normalizeMarketplaceItemForUi,
  sanitizeMarketplaceItemView,
  sanitizeMarketplaceListItems,
  toPositiveInt
} from "./catalog.js";
import {
  collectKnownSkillNames,
  collectSkillMarketplaceInstalledView,
  findUnsupportedSkillInstallKind,
  isSupportedMarketplaceSkillItem
} from "./installed.js";

async function installMarketplaceSkill(params: {
  options: UiRouterOptions;
  body: MarketplaceSkillInstallRequest;
}): Promise<MarketplaceSkillInstallResult> {
  const spec = typeof params.body.spec === "string" ? params.body.spec.trim() : "";
  if (!spec) {
    throw new Error("INVALID_BODY:non-empty spec is required");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }
  if (!installer.installSkill) {
    throw new Error("NOT_AVAILABLE:skill installer is not configured");
  }

  const result = await installer.installSkill({
    slug: spec,
    kind: params.body.kind,
    skill: params.body.skill,
    installPath: params.body.installPath,
    force: params.body.force
  });

  params.options.publish({ type: "config.updated", payload: { path: "skills" } });
  return {
    type: "skill",
    spec,
    message: result.message,
    output: result.output
  };
}

async function manageMarketplaceSkill(params: {
  options: UiRouterOptions;
  body: MarketplaceSkillManageRequest;
}): Promise<MarketplaceSkillManageResult> {
  const action = params.body.action;
  const targetId = typeof params.body.id === "string" && params.body.id.trim().length > 0
    ? params.body.id.trim()
    : typeof params.body.spec === "string" && params.body.spec.trim().length > 0
      ? params.body.spec.trim()
      : "";

  if (action !== "uninstall" || !targetId) {
    throw new Error("INVALID_BODY:skill manage requires uninstall action and non-empty id/spec");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }
  if (!installer.uninstallSkill) {
    throw new Error("NOT_AVAILABLE:skill uninstall is not configured");
  }

  const result = await installer.uninstallSkill(targetId);
  params.options.publish({ type: "config.updated", payload: { path: "skills" } });

  return {
    type: "skill",
    action,
    id: targetId,
    message: result.message,
    output: result.output
  };
}

export class SkillMarketplaceController {
  constructor(
    private readonly options: UiRouterOptions,
    private readonly marketplaceBaseUrl: string
  ) {}

  readonly getInstalled = (c: Context) => {
    return c.json(ok(collectSkillMarketplaceInstalledView(this.options)));
  };

  readonly listItems = async (c: Context) => {
    const query = c.req.query();
    const result = await fetchAllSkillMarketplaceItems({
      baseUrl: this.marketplaceBaseUrl,
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

    const normalizedItems = sanitizeMarketplaceListItems(result.data.items)
      .map((item) => normalizeMarketplaceItemForUi(item));
    const unsupportedKind = findUnsupportedSkillInstallKind(normalizedItems);
    if (unsupportedKind) {
      return c.json(
        err("MARKETPLACE_CONTRACT_MISMATCH", `unsupported skill install kind from marketplace api: ${unsupportedKind}`),
        502
      );
    }

    const knownSkillNames = collectKnownSkillNames(this.options);
    const filteredItems = normalizedItems.filter((item) => isSupportedMarketplaceSkillItem(item, knownSkillNames));

    const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
    const requestedPage = toPositiveInt(query.page, 1);
    const totalPages = filteredItems.length === 0 ? 0 : Math.ceil(filteredItems.length / pageSize);
    const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);

    return c.json(ok({
      total: filteredItems.length,
      page: currentPage,
      pageSize,
      totalPages,
      sort: result.data.sort,
      query: result.data.query,
      items: filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    }));
  };

  readonly getItem = async (c: Context) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: this.marketplaceBaseUrl,
      path: `/api/v1/skills/items/${slug}`
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const knownSkillNames = collectKnownSkillNames(this.options);
    const sanitized = normalizeMarketplaceItemForUi(sanitizeMarketplaceItemView(result.data));
    const unsupportedKind = findUnsupportedSkillInstallKind([sanitized]);
    if (unsupportedKind) {
      return c.json(
        err("MARKETPLACE_CONTRACT_MISMATCH", `unsupported skill install kind from marketplace api: ${unsupportedKind}`),
        502
      );
    }
    if (!isSupportedMarketplaceSkillItem(sanitized, knownSkillNames)) {
      return c.json(err("NOT_FOUND", "marketplace item not supported by nextclaw"), 404);
    }

    return c.json(ok(sanitized));
  };

  readonly getItemContent = async (c: Context) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: this.marketplaceBaseUrl,
      path: `/api/v1/skills/items/${slug}`
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const knownSkillNames = collectKnownSkillNames(this.options);
    const sanitized = normalizeMarketplaceItemForUi(sanitizeMarketplaceItemView(result.data));
    const unsupportedKind = findUnsupportedSkillInstallKind([sanitized]);
    if (unsupportedKind) {
      return c.json(
        err("MARKETPLACE_CONTRACT_MISMATCH", `unsupported skill install kind from marketplace api: ${unsupportedKind}`),
        502
      );
    }
    if (!isSupportedMarketplaceSkillItem(sanitized, knownSkillNames)) {
      return c.json(err("NOT_FOUND", "marketplace item not supported by nextclaw"), 404);
    }

    const contentResult = await fetchMarketplaceData<MarketplaceSkillContentView>({
      baseUrl: this.marketplaceBaseUrl,
      path: `/api/v1/skills/items/${slug}/content`
    });
    if (!contentResult.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", contentResult.message), contentResult.status as 500);
    }

    return c.json(ok(contentResult.data));
  };

  readonly install = async (c: Context) => {
    const body = await readJson<MarketplaceSkillInstallRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "skill") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    try {
      const payload = await installMarketplaceSkill({
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
    const body = await readJson<MarketplaceSkillManageRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "skill") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    try {
      const payload = await manageMarketplaceSkill({
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
      path: "/api/v1/skills/recommendations",
      query: {
        scene: query.scene,
        limit: query.limit
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    const knownSkillNames = collectKnownSkillNames(this.options);
    const filteredItems = sanitizeMarketplaceListItems(result.data.items)
      .map((item) => normalizeMarketplaceItemForUi(item))
      .filter((item) => isSupportedMarketplaceSkillItem(item, knownSkillNames));

    return c.json(ok({
      ...result.data,
      total: filteredItems.length,
      items: filteredItems
    }));
  };
}
