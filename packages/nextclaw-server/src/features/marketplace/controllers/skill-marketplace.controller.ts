import type { Context } from "hono";
import type {
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceRecommendationView,
  MarketplaceScenesView,
  MarketplaceSkillContentView,
  MarketplaceSkillInstallRequest,
  MarketplaceSkillInstallResult,
  MarketplaceSkillManageRequest,
  MarketplaceSkillManageResult
} from "@nextclaw-server/shared/types/server-api.types.js";
import { err, ok, readJson } from "@nextclaw-server/shared/utils/http-response.utils.js";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
import { emitConfigUpdated } from "@nextclaw-server/shared/utils/app-events.utils.js";
import {
  fetchMarketplaceData,
  normalizeMarketplaceItemForUi,
  sanitizeMarketplaceItemView,
  sanitizeMarketplaceListItems
} from "@nextclaw-server/features/marketplace/utils/marketplace-catalog.utils.js";
import {
  collectKnownSkillNames,
  collectSkillMarketplaceInstalledView,
  findUnsupportedSkillInstallKind,
  isSupportedMarketplaceSkillItem
} from "@nextclaw-server/features/marketplace/utils/marketplace-installed.utils.js";

type SupportedSkillMarketplaceListResult =
  | { ok: true; data: MarketplaceListView }
  | { ok: false; status: number; code: "MARKETPLACE_UNAVAILABLE" | "MARKETPLACE_CONTRACT_MISMATCH"; message: string };

async function installMarketplaceSkill(params: {
  options: UiRouterOptions;
  body: MarketplaceSkillInstallRequest;
}): Promise<MarketplaceSkillInstallResult> {
  const { body, options } = params;
  const spec = typeof body.spec === "string" ? body.spec.trim() : "";
  if (!spec) {
    throw new Error("INVALID_BODY:non-empty spec is required");
  }

  const installer = options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }
  if (!installer.installSkill) {
    throw new Error("NOT_AVAILABLE:skill installer is not configured");
  }

  const result = await installer.installSkill({
    slug: spec,
    kind: body.kind,
    skill: body.skill,
    installPath: body.installPath,
    force: body.force
  });

  emitConfigUpdated(options, "skills");
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
  const { body, options } = params;
  const action = body.action;
  const targetId = typeof body.id === "string" && body.id.trim().length > 0
    ? body.id.trim()
    : typeof body.spec === "string" && body.spec.trim().length > 0
      ? body.spec.trim()
      : "";

  if ((action !== "update" && action !== "uninstall") || !targetId) {
    throw new Error("INVALID_BODY:skill manage requires update/uninstall action and non-empty id/spec");
  }

  const installer = options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }

  if (action === "update") {
    if (!installer.updateSkill) {
      throw new Error("NOT_AVAILABLE:skill update is not configured");
    }

    const result = await installer.updateSkill({
      slug: targetId,
      force: body.force
    });
    emitConfigUpdated(options, "skills");

    return {
      type: "skill",
      action,
      id: targetId,
      message: result.message,
      output: result.output
    };
  }

  if (!installer.uninstallSkill) {
    throw new Error("NOT_AVAILABLE:skill uninstall is not configured");
  }

  const result = await installer.uninstallSkill(targetId);
  emitConfigUpdated(options, "skills");

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
    private readonly marketplaceBaseUrls: readonly string[]
  ) {}

  readonly getInstalled = (c: Context) => {
    return c.json(ok(collectSkillMarketplaceInstalledView(this.options)));
  };

  private readonly normalizeSupportedListData = (
    data: MarketplaceListView
  ): SupportedSkillMarketplaceListResult => {
    const normalizedItems = sanitizeMarketplaceListItems(data.items)
      .map((item) => normalizeMarketplaceItemForUi(item));
    const unsupportedKind = findUnsupportedSkillInstallKind(normalizedItems);
    if (unsupportedKind) {
      return {
        ok: false,
        code: "MARKETPLACE_CONTRACT_MISMATCH",
        status: 502,
        message: `unsupported skill install kind from marketplace api: ${unsupportedKind}`
      };
    }

    const knownSkillNames = collectKnownSkillNames(this.options);
    return {
      ok: true,
      data: {
        ...data,
        items: normalizedItems.filter((item) => isSupportedMarketplaceSkillItem(item, knownSkillNames))
      }
    };
  };

  private readonly loadSupportedListPage = async (
    query: Record<string, string | undefined>
  ): Promise<SupportedSkillMarketplaceListResult> => {
    const result = await fetchMarketplaceData<MarketplaceListView>({
      baseUrls: this.marketplaceBaseUrls,
      path: "/api/v1/skills/items",
      query
    });
    if (!result.ok) {
      return {
        ...result,
        code: "MARKETPLACE_UNAVAILABLE"
      };
    }
    return this.normalizeSupportedListData(result.data);
  };

  readonly listScenes = async (c: Context) => {
    const result = await fetchMarketplaceData<MarketplaceScenesView>({
      baseUrls: this.marketplaceBaseUrls,
      path: "/api/v1/skills/scenes"
    });
    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    return c.json(ok<MarketplaceScenesView>(result.data));
  };

  readonly listItems = async (c: Context) => {
    const query = c.req.query();
    const result = await this.loadSupportedListPage({
      q: query.q,
      scene: query.scene,
      tag: query.tag,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize
    });

    if (!result.ok) {
      return c.json(err(result.code, result.message), result.status as 500);
    }

    return c.json(ok(result.data));
  };

  readonly getItem = async (c: Context) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrls: this.marketplaceBaseUrls,
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
      baseUrls: this.marketplaceBaseUrls,
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
      baseUrls: this.marketplaceBaseUrls,
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
      baseUrls: this.marketplaceBaseUrls,
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
