import type { Context } from "hono";
import { appendAuditLog } from "@/repositories/platform.repository";
import { MarketplaceOwnerAppService } from "@/services/marketplace-owner-app.service";
import { ensurePlatformBootstrap, requireAuthUser } from "@/services/platform.service";
import type { Env, OwnerMarketplaceAppManageAction } from "@/types/platform";
import { apiError, readJson, readString } from "@/utils/platform.utils";

const OWNER_MARKETPLACE_APP_MANAGE_ACTIONS = ["hide", "show", "delete"] as const;

export async function ownerMarketplaceAppsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const service = new MarketplaceOwnerAppService(c.env, c.req.header("authorization"));
  const q = readOptionalQueryString(c.req.query("q"));
  const data = await service.listApps({
    q: q ?? undefined,
  });
  return c.json({
    ok: true,
    data,
  });
}

export async function ownerMarketplaceAppDetailHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const service = new MarketplaceOwnerAppService(c.env, c.req.header("authorization"));
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

export async function manageOwnerMarketplaceAppHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const selector = c.req.param("selector");
  const service = new MarketplaceOwnerAppService(c.env, c.req.header("authorization"));
  const before = await service.getAppDetail(selector);
  if (!before) {
    return apiError(c, 404, "MARKETPLACE_APP_NOT_FOUND", "Marketplace app not found.");
  }
  const body = await readJson(c);
  const action = readOwnerMarketplaceManageAction(readString(body, "action"));
  if (!action) {
    return apiError(c, 400, "INVALID_ACTION", "action must be hide, show, or delete.");
  }
  const data = await service.manageApp({
    selector,
    action,
  });
  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "user.marketplace.app.manage",
    targetType: "marketplace_app",
    targetId: before.appId,
    beforeJson: JSON.stringify(before),
    afterJson: JSON.stringify(data.item),
    metadataJson: JSON.stringify({
      selector,
      action,
    }),
  });
  return c.json({
    ok: true,
    data,
  });
}

function readOwnerMarketplaceManageAction(raw: string): OwnerMarketplaceAppManageAction | null {
  if (OWNER_MARKETPLACE_APP_MANAGE_ACTIONS.includes(raw as OwnerMarketplaceAppManageAction)) {
    return raw as OwnerMarketplaceAppManageAction;
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
