import type { Context } from "hono";
import type { Env } from "@/types/platform";
import { appendAuditLog, appendLedger, getRechargeIntentById } from "@/repositories/platform.repository";
import { ensurePlatformBootstrap, requireAdminUser } from "@/services/platform.service";
import { apiError, roundUsd } from "@/utils/platform.utils";

export async function confirmRechargeIntentHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const intentId = c.req.param("intentId");
  const intent = await getRechargeIntentById(c.env.NEXTCLAW_PLATFORM_DB, intentId);
  if (!intent) {
    return apiError(c, 404, "RECHARGE_INTENT_NOT_FOUND", "Recharge intent not found.");
  }
  if (intent.status !== "pending") {
    return apiError(c, 409, "RECHARGE_INTENT_NOT_PENDING", "Recharge intent is not pending.");
  }

  const now = new Date().toISOString();
  const markConfirmed = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `UPDATE recharge_intents
        SET status = 'confirmed',
            confirmed_at = ?,
            confirmed_by_user_id = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(now, admin.user.id, now, intentId)
    .run();
  if (!markConfirmed.success || (markConfirmed.meta.changes ?? 0) !== 1) {
    return apiError(c, 500, "RECHARGE_INTENT_CONFIRM_FAILED", "Failed to confirm recharge intent.");
  }

  const creditUser = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `UPDATE users
        SET paid_balance_usd = paid_balance_usd + ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(intent.amount_usd, now, intent.user_id)
    .run();
  if (!creditUser.success || (creditUser.meta.changes ?? 0) !== 1) {
    await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      `UPDATE recharge_intents
          SET status = 'pending',
              confirmed_at = NULL,
              confirmed_by_user_id = NULL,
              updated_at = ?
        WHERE id = ?`
    )
      .bind(now, intentId)
      .run();
    return apiError(c, 500, "RECHARGE_APPLY_FAILED", "Recharge intent confirmed but user balance update failed.");
  }

  try {
    await appendLedger(c.env.NEXTCLAW_PLATFORM_DB, {
      id: crypto.randomUUID(),
      userId: intent.user_id,
      kind: "recharge",
      amountUsd: roundUsd(intent.amount_usd),
      freeAmountUsd: 0,
      paidAmountUsd: roundUsd(intent.amount_usd),
      model: null,
      promptTokens: 0,
      completionTokens: 0,
      requestId: `recharge:${intent.id}`,
      note: `Recharge confirmed by ${admin.user.email}`
    });
  } catch {
    await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      `UPDATE users
          SET paid_balance_usd = MAX(0, paid_balance_usd - ?),
              updated_at = ?
        WHERE id = ?`
    )
      .bind(intent.amount_usd, now, intent.user_id)
      .run();
    await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      `UPDATE recharge_intents
          SET status = 'pending',
              confirmed_at = NULL,
              confirmed_by_user_id = NULL,
              updated_at = ?
        WHERE id = ?`
    )
      .bind(now, intentId)
      .run();
    return apiError(c, 500, "RECHARGE_LEDGER_FAILED", "Recharge applied but ledger write failed, rolled back.");
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: admin.user.id,
    action: "admin.recharge.confirm",
    targetType: "recharge_intent",
    targetId: intent.id,
    beforeJson: JSON.stringify({ status: intent.status }),
    afterJson: JSON.stringify({ status: "confirmed", confirmedByUserId: admin.user.id, confirmedAt: now }),
    metadataJson: JSON.stringify({ amountUsd: intent.amount_usd, userId: intent.user_id })
  });

  return c.json({
    ok: true,
    data: {
      intentId: intent.id,
      status: "confirmed"
    }
  });
}

export async function rejectRechargeIntentHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const intentId = c.req.param("intentId");
  const intent = await getRechargeIntentById(c.env.NEXTCLAW_PLATFORM_DB, intentId);
  if (!intent) {
    return apiError(c, 404, "RECHARGE_INTENT_NOT_FOUND", "Recharge intent not found.");
  }
  if (intent.status !== "pending") {
    return apiError(c, 409, "RECHARGE_INTENT_NOT_PENDING", "Recharge intent is not pending.");
  }

  const now = new Date().toISOString();
  const markRejected = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
    `UPDATE recharge_intents
        SET status = 'rejected',
            rejected_at = ?,
            rejected_by_user_id = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(now, admin.user.id, now, intentId)
    .run();

  if (!markRejected.success || (markRejected.meta.changes ?? 0) !== 1) {
    return apiError(c, 500, "RECHARGE_INTENT_REJECT_FAILED", "Failed to reject recharge intent.");
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: admin.user.id,
    action: "admin.recharge.reject",
    targetType: "recharge_intent",
    targetId: intent.id,
    beforeJson: JSON.stringify({ status: intent.status }),
    afterJson: JSON.stringify({ status: "rejected", rejectedByUserId: admin.user.id, rejectedAt: now }),
    metadataJson: JSON.stringify({ amountUsd: intent.amount_usd, userId: intent.user_id })
  });

  return c.json({
    ok: true,
    data: {
      intentId: intent.id,
      status: "rejected"
    }
  });
}
