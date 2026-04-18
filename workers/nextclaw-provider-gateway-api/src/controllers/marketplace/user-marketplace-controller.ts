import type { Context } from "hono";
import { appendAuditLog } from "../../repositories/platform-repository";
import { MarketplaceOwnerSkillService } from "../../services/marketplace-owner-skill.service";
import { ensurePlatformBootstrap, requireAuthUser } from "../../services/platform-service";
import type { Env, OwnerMarketplaceSkillManageAction } from "../../types/platform";
import { apiError, readJson, readString } from "../../utils/platform-utils";

const OWNER_MARKETPLACE_MANAGE_ACTIONS = ["hide", "show", "delete"] as const;

export async function ownerMarketplaceSkillsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const service = new MarketplaceOwnerSkillService(c.env, c.req.header("authorization"));
  const q = readOptionalQueryString(c.req.query("q"));
  const data = await service.listSkills({
    q: q ?? undefined
  });

  return c.json({
    ok: true,
    data
  });
}

export async function ownerMarketplaceSkillDetailHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const service = new MarketplaceOwnerSkillService(c.env, c.req.header("authorization"));
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

export async function manageOwnerMarketplaceSkillHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const selector = c.req.param("selector");
  const service = new MarketplaceOwnerSkillService(c.env, c.req.header("authorization"));
  const before = await service.getSkillDetail(selector);
  if (!before) {
    return apiError(c, 404, "MARKETPLACE_SKILL_NOT_FOUND", "Marketplace skill not found.");
  }

  const body = await readJson(c);
  const action = readOwnerMarketplaceManageAction(readString(body, "action"));
  if (!action) {
    return apiError(c, 400, "INVALID_ACTION", "action must be hide, show, or delete.");
  }
  const data = await service.manageSkill({
    selector,
    action
  });

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "user.marketplace.skill.manage",
    targetType: "marketplace_skill",
    targetId: before.packageName,
    beforeJson: JSON.stringify(before),
    afterJson: JSON.stringify(data.item),
    metadataJson: JSON.stringify({
      selector,
      action
    })
  });

  return c.json({
    ok: true,
    data
  });
}

function readOwnerMarketplaceManageAction(raw: string): OwnerMarketplaceSkillManageAction | null {
  if (OWNER_MARKETPLACE_MANAGE_ACTIONS.includes(raw as OwnerMarketplaceSkillManageAction)) {
    return raw as OwnerMarketplaceSkillManageAction;
  }
  return null;
}

function readOptionalQueryString(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
