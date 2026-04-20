import type { Context } from "hono";
import { appendAuditLog } from "../../repositories/platform.repository";
import { MarketplaceAdminService } from "../../services/marketplace-admin.service";
import { ensurePlatformBootstrap, requireAdminUser } from "../../services/platform.service";
import type {
  AdminMarketplaceSkillPublishStatus,
  AdminMarketplaceSkillReviewStatus,
  Env,
} from "../../types/platform";
import { apiError, parseBoundedInt, readJson, readString } from "../../utils/platform.utils";

const ADMIN_MARKETPLACE_SKILL_STATUS_VALUES = ["pending", "published", "rejected", "all"] as const;
const ADMIN_MARKETPLACE_SKILL_REVIEW_STATUS_VALUES = ["published", "rejected"] as const;

export async function adminMarketplaceSkillsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const service = new MarketplaceAdminService(c.env, c.req.header("authorization"));
  const publishStatus = readAdminMarketplacePublishStatus(c.req.query("publishStatus"));
  const q = readOptionalQueryString(c.req.query("q"));
  const page = parseBoundedInt(c.req.query("page"), 1, 1, 999);
  const pageSize = parseBoundedInt(c.req.query("pageSize"), 20, 1, 100);
  const data = await service.listSkills({
    publishStatus,
    q: q ?? undefined,
    page,
    pageSize
  });

  return c.json({
    ok: true,
    data
  });
}

export async function adminMarketplaceSkillDetailHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const service = new MarketplaceAdminService(c.env, c.req.header("authorization"));
  const selector = c.req.param("selector");
  const data = await service.getSkillDetail(selector);
  if (!data) {
    return apiError(c, 404, "MARKETPLACE_SKILL_NOT_FOUND", "Marketplace skill not found.");
  }

  return c.json({
    ok: true,
    data
  });
}

export async function reviewAdminMarketplaceSkillHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const service = new MarketplaceAdminService(c.env, c.req.header("authorization"));
  const selector = c.req.param("selector");
  const before = await service.getSkillDetail(selector);
  if (!before) {
    return apiError(c, 404, "MARKETPLACE_SKILL_NOT_FOUND", "Marketplace skill not found.");
  }

  const body = await readJson(c);
  const publishStatus = readAdminMarketplaceReviewStatus(readString(body, "publishStatus"));
  const reviewNote = readOptionalQueryString(readString(body, "reviewNote"));
  if (publishStatus === "rejected" && !reviewNote) {
    return apiError(c, 400, "REVIEW_NOTE_REQUIRED", "reviewNote is required when rejecting a marketplace skill.");
  }

  const data = await service.reviewSkill({
    selector,
    publishStatus,
    reviewNote: reviewNote ?? undefined
  });

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: admin.user.id,
    action: "admin.marketplace.skill.review",
    targetType: "marketplace_skill",
    targetId: before.item.packageName,
    beforeJson: JSON.stringify(before.item),
    afterJson: JSON.stringify(data.item),
    metadataJson: JSON.stringify({
      selector,
      publishStatus,
      reviewNote: reviewNote ?? null
    })
  });

  return c.json({
    ok: true,
    data
  });
}

function readAdminMarketplacePublishStatus(raw: string | undefined): AdminMarketplaceSkillPublishStatus {
  if (!raw) {
    return "pending";
  }
  if (!ADMIN_MARKETPLACE_SKILL_STATUS_VALUES.includes(raw as AdminMarketplaceSkillPublishStatus)) {
    return "pending";
  }
  return raw as AdminMarketplaceSkillPublishStatus;
}

function readAdminMarketplaceReviewStatus(raw: string): AdminMarketplaceSkillReviewStatus {
  if (!ADMIN_MARKETPLACE_SKILL_REVIEW_STATUS_VALUES.includes(raw as AdminMarketplaceSkillReviewStatus)) {
    return "published";
  }
  return raw as AdminMarketplaceSkillReviewStatus;
}

function readOptionalQueryString(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
