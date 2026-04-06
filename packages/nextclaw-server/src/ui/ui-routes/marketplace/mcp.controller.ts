import { McpInstalledViewService } from "@nextclaw/mcp";
import type { Context } from "hono";
import type {
  MarketplaceInstalledView,
  MarketplaceItemView,
  MarketplaceMcpContentView,
  MarketplaceMcpDoctorResult,
  MarketplaceMcpInstallRequest,
  MarketplaceMcpInstallResult,
  MarketplaceMcpInstallSpec,
  MarketplaceMcpManageRequest,
  MarketplaceMcpManageResult,
  MarketplaceRecommendationView
} from "../../types.js";
import { loadConfigOrDefault } from "../../config.js";
import { err, ok, readJson } from "../response.js";
import type { UiRouterOptions } from "../types.js";
import {
  fetchAllMcpMarketplaceItems,
  fetchMarketplaceData,
  normalizeMarketplaceItemForUi,
  sanitizeMarketplaceItemView,
  sanitizeMarketplaceListItems,
  toPositiveInt
} from "./catalog.js";

export class McpMarketplaceController {
  constructor(
    private readonly options: UiRouterOptions,
    private readonly marketplaceBaseUrl: string
  ) {}

  readonly getInstalled = (c: Context) => {
    const service = new McpInstalledViewService({
      getConfig: () => loadConfigOrDefault(this.options.configPath)
    });
    const records = service.listInstalled().map((record) => ({
      type: "mcp" as const,
      id: record.name,
      spec: record.catalogSlug ?? record.name,
      label: record.displayName ?? record.name,
      enabled: record.enabled,
      runtimeStatus: record.enabled ? "enabled" : "disabled",
      transport: record.transport,
      scope: record.scope,
      catalogSlug: record.catalogSlug,
      vendor: record.vendor,
      docsUrl: record.docsUrl,
      homepage: record.homepage,
      trustLevel: record.trustLevel,
      source: record.source,
      installedAt: record.installedAt,
      toolCount: record.toolCount,
      accessible: record.accessible,
      lastReadyAt: record.lastReadyAt,
      lastDoctorAt: record.lastReadyAt,
      lastError: record.lastError
    }));

    return c.json(ok({
      type: "mcp",
      total: records.length,
      specs: records.map((record) => record.spec),
      records
    } satisfies MarketplaceInstalledView));
  };

  readonly listItems = async (c: Context) => {
    const query = c.req.query();
    const result = await fetchAllMcpMarketplaceItems({
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

    const items = sanitizeMarketplaceListItems(result.data.items).map((item) => normalizeMarketplaceItemForUi(item));
    const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
    const requestedPage = toPositiveInt(query.page, 1);
    const totalPages = items.length === 0 ? 0 : Math.ceil(items.length / pageSize);
    const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);

    return c.json(ok({
      total: items.length,
      page: currentPage,
      pageSize,
      totalPages,
      sort: result.data.sort,
      query: result.data.query,
      items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    }));
  };

  readonly getItem = async (c: Context) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: this.marketplaceBaseUrl,
      path: `/api/v1/mcp/items/${slug}`
    });
    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }
    return c.json(ok(normalizeMarketplaceItemForUi(sanitizeMarketplaceItemView(result.data))));
  };

  readonly getItemContent = async (c: Context) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const result = await fetchMarketplaceData<MarketplaceMcpContentView>({
      baseUrl: this.marketplaceBaseUrl,
      path: `/api/v1/mcp/items/${slug}/content`
    });
    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }
    return c.json(ok(result.data));
  };

  readonly install = async (c: Context) => {
    const body = await readJson<MarketplaceMcpInstallRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "mcp") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    const slug = typeof body.data.spec === "string" ? body.data.spec.trim() : "";
    if (!slug) {
      return c.json(err("INVALID_BODY", "non-empty spec is required"), 400);
    }

    const installer = this.options.marketplace?.installer;
    if (!installer?.installMcp) {
      return c.json(err("NOT_AVAILABLE", "mcp installer is not configured"), 503);
    }

    const itemResult = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: this.marketplaceBaseUrl,
      path: `/api/v1/mcp/items/${encodeURIComponent(slug)}`
    });
    if (!itemResult.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", itemResult.message), itemResult.status as 500);
    }

    const template = itemResult.data.install as MarketplaceMcpInstallSpec;
    if (template.kind !== "template") {
      return c.json(err("MARKETPLACE_CONTRACT_MISMATCH", `unsupported mcp install kind: ${template.kind}`), 502);
    }

    try {
      const result = await installer.installMcp({
        ...body.data,
        template
      });
      this.options.publish({ type: "config.updated", payload: { path: "mcp" } });
      return c.json(ok({
        type: "mcp",
        spec: slug,
        name: result.name,
        message: result.message,
        output: result.output
      } satisfies MarketplaceMcpInstallResult));
    } catch (error) {
      return c.json(err("INSTALL_FAILED", error instanceof Error ? error.message : String(error)), 400);
    }
  };

  readonly manage = async (c: Context) => {
    const body = await readJson<MarketplaceMcpManageRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (body.data.type && body.data.type !== "mcp") {
      return c.json(err("INVALID_BODY", "body.type does not match route type"), 400);
    }

    const target = typeof body.data.id === "string" && body.data.id.trim().length > 0
      ? body.data.id.trim()
      : typeof body.data.spec === "string" && body.data.spec.trim().length > 0
        ? body.data.spec.trim()
        : "";
    if (!target) {
      return c.json(err("INVALID_BODY", "non-empty id/spec is required"), 400);
    }

    const installer = this.options.marketplace?.installer;
    if (!installer) {
      return c.json(err("NOT_AVAILABLE", "marketplace installer is not configured"), 503);
    }

    try {
      const action = body.data.action;
      const result = action === "enable"
        ? await installer.enableMcp?.(target)
        : action === "disable"
          ? await installer.disableMcp?.(target)
          : await installer.removeMcp?.(target);

      if (!result) {
        return c.json(err("NOT_AVAILABLE", `mcp ${action} is not configured`), 503);
      }

      this.options.publish({ type: "config.updated", payload: { path: "mcp" } });
      return c.json(ok({
        type: "mcp",
        action,
        id: target,
        message: result.message,
        output: result.output
      } satisfies MarketplaceMcpManageResult));
    } catch (error) {
      return c.json(err("MANAGE_FAILED", error instanceof Error ? error.message : String(error)), 400);
    }
  };

  readonly doctor = async (c: Context) => {
    const body = await readJson<{ name?: string; id?: string; spec?: string }>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const target = typeof body.data.name === "string" && body.data.name.trim().length > 0
      ? body.data.name.trim()
      : typeof body.data.id === "string" && body.data.id.trim().length > 0
        ? body.data.id.trim()
        : typeof body.data.spec === "string" && body.data.spec.trim().length > 0
          ? body.data.spec.trim()
          : "";
    if (!target) {
      return c.json(err("INVALID_BODY", "name/id/spec is required"), 400);
    }

    const installer = this.options.marketplace?.installer;
    if (!installer?.doctorMcp) {
      return c.json(err("NOT_AVAILABLE", "mcp doctor is not configured"), 503);
    }

    try {
      const result = await installer.doctorMcp(target);
      return c.json(ok(result satisfies MarketplaceMcpDoctorResult));
    } catch (error) {
      return c.json(err("DOCTOR_FAILED", error instanceof Error ? error.message : String(error)), 400);
    }
  };

  readonly getRecommendations = async (c: Context) => {
    const query = c.req.query();
    const result = await fetchMarketplaceData<MarketplaceRecommendationView>({
      baseUrl: this.marketplaceBaseUrl,
      path: "/api/v1/mcp/recommendations",
      query: {
        scene: query.scene,
        limit: query.limit
      }
    });
    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }
    return c.json(ok({
      ...result.data,
      items: sanitizeMarketplaceListItems(result.data.items).map((item) => normalizeMarketplaceItemForUi(item))
    }));
  };
}
