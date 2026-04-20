import type { Context } from "hono";
import type { Env, LedgerRow, RechargeIntentRow } from "@/types/platform";
import {
  getUserById,
  readBillingSnapshot,
  toBillingOverview,
  toLedgerView,
  toRechargeIntentView
} from "@/repositories/platform.repository";
import { ensurePlatformBootstrap, requireAuthUser } from "@/services/platform.service";
import {
  apiError,
  decodeCursorToken,
  optionalTrimmedString,
  paginateRows,
  parseBoundedInt,
  parsePositiveUsd,
  readJson,
  readNumber,
  readString,
  roundUsd
} from "@/utils/platform.utils";

export async function billingOverviewHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const snapshot = await readBillingSnapshot(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  if (!snapshot) {
    return apiError(c, 404, "USER_NOT_FOUND", "User not found.");
  }

  return c.json({
    ok: true,
    data: toBillingOverview(snapshot)
  });
}

export async function billingLedgerHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 200);
  const cursor = decodeCursorToken(c.req.query("cursor"));
  const rows = cursor
    ? await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      `SELECT id, user_id, kind, amount_usd, free_amount_usd, paid_amount_usd,
              model, prompt_tokens, completion_tokens, request_id, note, created_at
         FROM usage_ledger
        WHERE user_id = ?
          AND (created_at < ? OR (created_at = ? AND id < ?))
        ORDER BY created_at DESC, id DESC
        LIMIT ?`
    )
      .bind(auth.user.id, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
      .all<LedgerRow>()
    : await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      `SELECT id, user_id, kind, amount_usd, free_amount_usd, paid_amount_usd,
              model, prompt_tokens, completion_tokens, request_id, note, created_at
         FROM usage_ledger
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?`
    )
      .bind(auth.user.id, limit + 1)
      .all<LedgerRow>();

  const pagination = paginateRows(rows.results ?? [], limit);

  return c.json({
    ok: true,
    data: {
      items: pagination.items.map(toLedgerView),
      nextCursor: pagination.nextCursor,
      hasMore: pagination.hasMore
    }
  });
}

export async function billingRechargeIntentsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const limit = parseBoundedInt(c.req.query("limit"), 20, 1, 100);
  const cursor = decodeCursorToken(c.req.query("cursor"));
  const rows = cursor
    ? await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      `SELECT id, user_id, amount_usd, status, note, created_at, updated_at,
              confirmed_at, confirmed_by_user_id, rejected_at, rejected_by_user_id
         FROM recharge_intents
        WHERE user_id = ?
          AND (created_at < ? OR (created_at = ? AND id < ?))
        ORDER BY created_at DESC, id DESC
        LIMIT ?`
    )
      .bind(auth.user.id, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
      .all<RechargeIntentRow>()
    : await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      `SELECT id, user_id, amount_usd, status, note, created_at, updated_at,
              confirmed_at, confirmed_by_user_id, rejected_at, rejected_by_user_id
         FROM recharge_intents
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?`
    )
      .bind(auth.user.id, limit + 1)
      .all<RechargeIntentRow>();

  const pagination = paginateRows(rows.results ?? [], limit);

  return c.json({
    ok: true,
    data: {
      items: pagination.items.map(toRechargeIntentView),
      nextCursor: pagination.nextCursor,
      hasMore: pagination.hasMore
    }
  });
}

export async function createRechargeIntentHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(c);
  const amountUsd = parsePositiveUsd(readNumber(body, "amountUsd"));
  const note = optionalTrimmedString(readString(body, "note"));

  if (amountUsd <= 0) {
    return apiError(c, 400, "INVALID_AMOUNT", "amountUsd must be a positive number.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const inserted = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `INSERT INTO recharge_intents (
      id, user_id, amount_usd, status, note,
      created_at, updated_at,
      confirmed_at, confirmed_by_user_id,
      rejected_at, rejected_by_user_id
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, NULL, NULL)`
  )
    .bind(id, auth.user.id, amountUsd, note ?? null, now, now)
    .run();

  if (!inserted.success) {
    return apiError(c, 500, "RECHARGE_INTENT_CREATE_FAILED", "Failed to create recharge intent.");
  }

  return c.json({
    ok: true,
    data: {
      id,
      amountUsd,
      status: "pending",
      note: note ?? null,
      createdAt: now
    }
  }, 201);
}

export async function usageHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const snapshot = await readBillingSnapshot(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  if (!snapshot) {
    return apiError(c, 404, "USER_NOT_FOUND", "User not found.");
  }

  const user = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  if (!user) {
    return apiError(c, 404, "USER_NOT_FOUND", "User not found.");
  }

  return c.json({
    object: "nextclaw.usage",
    data: {
      totalCostUsd: roundUsd(snapshot.user.free_used_usd + Math.max(0, snapshot.user.paid_balance_usd)),
      freeQuotaUsdLimit: roundUsd(snapshot.user.free_limit_usd),
      freeQuotaUsdUsed: roundUsd(snapshot.user.free_used_usd),
      freeQuotaUsdRemaining: roundUsd(Math.max(0, snapshot.user.free_limit_usd - snapshot.user.free_used_usd)),
      paidBalanceUsd: roundUsd(snapshot.user.paid_balance_usd),
      globalFreeUsdLimit: roundUsd(snapshot.globalFreeLimitUsd),
      globalFreeUsdUsed: roundUsd(snapshot.globalFreeUsedUsd),
      globalFreeUsdRemaining: roundUsd(Math.max(0, snapshot.globalFreeLimitUsd - snapshot.globalFreeUsedUsd)),
      updatedAt: user.updated_at
    }
  });
}
