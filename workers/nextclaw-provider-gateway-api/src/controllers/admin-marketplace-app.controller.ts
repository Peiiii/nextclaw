import type { Context } from "hono";
import { appendAuditLog } from "@/repositories/platform.repository";
import { MarketplaceAdminAppService } from "@/services/marketplace-admin-app.service";
import { ensurePlatformBootstrap, requireAdminUser } from "@/services/platform.service";
import type {
  AdminMarketplaceAppCatalogVisibility,
  AdminMarketplaceAppPublishStatus,
  AdminMarketplaceAppReviewStatus,
  Env,
} from "@/types/platform";
import { apiError, parseBoundedInt, readJson, readString } from "@/utils/platform.utils";

const ADMIN_MARKETPLACE_APP_STATUS_VALUES = ["pending", "published", "rejected", "all"] as const;
const ADMIN_MARKETPLACE_APP_REVIEW_STATUS_VALUES = ["published", "rejected"] as const;
const ADMIN_MARKETPLACE_APP_CATALOG_VISIBILITY_VALUES = ["listed", "unlisted"] as const;

export async function adminMarketplaceAppsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }
  const service = new MarketplaceAdminAppService(c.env, c.req.header("authorization"));
  const publishStatus = readAdminMarketplacePublishStatus(c.req.query("publishStatus"));
  const q = readOptionalQueryString(c.req.query("q"));
  const page = parseBoundedInt(c.req.query("page"), 1, 1, 999);
  const pageSize = parseBoundedInt(c.req.query("pageSize"), 20, 1, 100);
  const data = await service.listApps({
    publishStatus,
    q: q ?? undefined,
    page,
    pageSize,
  });
  return c.json({
    ok: true,
    data,
  });
}

export async function adminMarketplaceAppDetailHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }
  const service = new MarketplaceAdminAppService(c.env, c.req.header("authorization"));
  const selector = c.req.param("selector");
  const data = await service.getAppDetail(selector);
  if (!data) {
    return apiError(c, 404, "MARKETPLACE_APP_NOT_FOUND", "Marketplace app not found.");
  }
  return c.json({
    ok: true,
    data,
  });
}

export async function reviewAdminMarketplaceAppHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }
  const service = new MarketplaceAdminAppService(c.env, c.req.header("authorization"));
  const selector = c.req.param("selector");
  const before = await service.getAppDetail(selector);
  if (!before) {
    return apiError(c, 404, "MARKETPLACE_APP_NOT_FOUND", "Marketplace app not found.");
  }
  const body = await readJson(c);
  const publishStatus = readAdminMarketplaceReviewStatus(readString(body, "publishStatus"));
  const rawCatalogVisibility = readString(body, "catalogVisibility");
  const catalogVisibility = readAdminMarketplaceCatalogVisibility(rawCatalogVisibility);
  if (rawCatalogVisibility && !catalogVisibility) {
    return apiError(c, 400, "INVALID_CATALOG_VISIBILITY", "catalogVisibility must be listed or unlisted.");
  }
  const reviewNote = readOptionalQueryString(readString(body, "reviewNote"));
  if (publishStatus === "rejected" && !reviewNote) {
    return apiError(c, 400, "REVIEW_NOTE_REQUIRED", "reviewNote is required when rejecting a marketplace app.");
  }
  const data = await service.reviewApp({
    selector,
    publishStatus,
    catalogVisibility,
    reviewNote: reviewNote ?? undefined,
  });
  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: admin.user.id,
    action: "admin.marketplace.app.review",
    targetType: "marketplace_app",
    targetId: before.item.appId,
    beforeJson: JSON.stringify(before.item),
    afterJson: JSON.stringify(data.item),
    metadataJson: JSON.stringify({
      selector,
      publishStatus,
      catalogVisibility: catalogVisibility ?? null,
      reviewNote: reviewNote ?? null,
    }),
  });
  return c.json({
    ok: true,
    data,
  });
}

function readAdminMarketplacePublishStatus(raw: string | undefined): AdminMarketplaceAppPublishStatus {
  if (!raw) {
    return "pending";
  }
  if (!ADMIN_MARKETPLACE_APP_STATUS_VALUES.includes(raw as AdminMarketplaceAppPublishStatus)) {
    return "pending";
  }
  return raw as AdminMarketplaceAppPublishStatus;
}

function readAdminMarketplaceReviewStatus(raw: string): AdminMarketplaceAppReviewStatus {
  if (!ADMIN_MARKETPLACE_APP_REVIEW_STATUS_VALUES.includes(raw as AdminMarketplaceAppReviewStatus)) {
    return "published";
  }
  return raw as AdminMarketplaceAppReviewStatus;
}

function readAdminMarketplaceCatalogVisibility(
  raw: string,
): AdminMarketplaceAppCatalogVisibility | undefined {
  if (!raw) {
    return undefined;
  }
  return ADMIN_MARKETPLACE_APP_CATALOG_VISIBILITY_VALUES.includes(
    raw as AdminMarketplaceAppCatalogVisibility,
  ) ? raw as AdminMarketplaceAppCatalogVisibility : undefined;
}

function readOptionalQueryString(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
