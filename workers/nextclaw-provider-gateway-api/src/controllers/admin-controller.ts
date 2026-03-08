import type { Context } from "hono";
import type { Env, RechargeIntentRow, UserRow } from "../types/platform";
import {
  appendAuditLog,
  appendLedger,
  createProviderAccount,
  countRechargeIntentsByStatus,
  countUsers,
  getRechargeIntentById,
  getProviderAccountById,
  getUserById,
  listModelCatalog,
  listProviderAccounts,
  patchProviderAccount,
  readPlatformNumberSetting,
  readProfitOverview,
  toModelCatalogView,
  toProviderAccountView,
  toRechargeIntentView,
  toUserPublicView,
  upsertModelCatalog,
  writePlatformNumberSetting
} from "../repositories/platform-repository";
import { ensurePlatformBootstrap, requireAdminUser } from "../services/platform-service";
import {
  apiError,
  decodeCursorToken,
  getGlobalFreeLimit,
  optionalTrimmedString,
  paginateRows,
  parseBoundedInt,
  readJson,
  readNumber,
  readUnknown,
  roundUsd
} from "../utils/platform-utils";

export async function adminOverviewHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const globalFreeLimitUsd = await readPlatformNumberSetting(c.env.NEXTCLAW_PLATFORM_DB, "global_free_limit_usd", getGlobalFreeLimit(c.env));
  const globalFreeUsedUsd = await readPlatformNumberSetting(c.env.NEXTCLAW_PLATFORM_DB, "global_free_used_usd", 0);
  const userCount = await countUsers(c.env.NEXTCLAW_PLATFORM_DB);
  const pendingRechargeIntents = await countRechargeIntentsByStatus(c.env.NEXTCLAW_PLATFORM_DB, "pending");

  return c.json({
    ok: true,
    data: {
      globalFreeLimitUsd: roundUsd(globalFreeLimitUsd),
      globalFreeUsedUsd: roundUsd(globalFreeUsedUsd),
      globalFreeRemainingUsd: roundUsd(Math.max(0, globalFreeLimitUsd - globalFreeUsedUsd)),
      userCount,
      pendingRechargeIntents
    }
  });
}

export async function adminProvidersHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const rows = await listProviderAccounts(c.env.NEXTCLAW_PLATFORM_DB);
  return c.json({
    ok: true,
    data: {
      items: rows.map(toProviderAccountView)
    }
  });
}

export async function createAdminProviderHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJson(c);
  const providerRaw = readUnknown(body, "provider");
  const authTypeRaw = readUnknown(body, "authType");
  const apiBaseRaw = readUnknown(body, "apiBase");
  const accessTokenRaw = readUnknown(body, "accessToken");
  const displayNameRaw = readUnknown(body, "displayName");
  const enabledRaw = readUnknown(body, "enabled");
  const priorityRaw = readUnknown(body, "priority");

  const provider = typeof providerRaw === "string" ? providerRaw.trim() : "";
  const authType = authTypeRaw === "api_key" ? "api_key" : "oauth";
  const apiBase = typeof apiBaseRaw === "string" ? apiBaseRaw.trim() : "";
  const accessToken = typeof accessTokenRaw === "string" ? accessTokenRaw.trim() : "";
  const displayName = typeof displayNameRaw === "string" ? displayNameRaw.trim() : "";
  const enabled = typeof enabledRaw === "boolean" ? enabledRaw : true;
  const priority = typeof priorityRaw === "number" && Number.isFinite(priorityRaw)
    ? Math.max(0, Math.floor(priorityRaw))
    : 100;

  if (!provider) {
    return apiError(c, 400, "INVALID_PROVIDER", "provider is required.");
  }
  if (!apiBase) {
    return apiError(c, 400, "INVALID_API_BASE", "apiBase is required.");
  }
  if (!accessToken) {
    return apiError(c, 400, "INVALID_ACCESS_TOKEN", "accessToken is required.");
  }

  const providerId = crypto.randomUUID();
  await createProviderAccount(c.env.NEXTCLAW_PLATFORM_DB, {
    id: providerId,
    provider,
    displayName: displayName.length > 0 ? displayName : null,
    authType,
    apiBase,
    accessToken,
    enabled,
    priority
  });

  const created = await getProviderAccountById(c.env.NEXTCLAW_PLATFORM_DB, providerId);
  if (!created) {
    return apiError(c, 500, "PROVIDER_CREATE_FAILED", "Provider created but cannot be loaded.");
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: admin.user.id,
    action: "admin.provider.create",
    targetType: "provider_account",
    targetId: providerId,
    beforeJson: null,
    afterJson: JSON.stringify(toProviderAccountView(created)),
    metadataJson: JSON.stringify({ provider, authType })
  });

  return c.json({
    ok: true,
    data: {
      provider: toProviderAccountView(created)
    }
  }, 201);
}

export async function patchAdminProviderHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const providerId = c.req.param("providerId");
  const before = await getProviderAccountById(c.env.NEXTCLAW_PLATFORM_DB, providerId);
  if (!before) {
    return apiError(c, 404, "PROVIDER_NOT_FOUND", "Provider account not found.");
  }

  const body = await readJson(c);
  const displayNameRaw = readUnknown(body, "displayName");
  const authTypeRaw = readUnknown(body, "authType");
  const apiBaseRaw = readUnknown(body, "apiBase");
  const accessTokenRaw = readUnknown(body, "accessToken");
  const enabledRaw = readUnknown(body, "enabled");
  const priorityRaw = readUnknown(body, "priority");

  const changed = await patchProviderAccount(c.env.NEXTCLAW_PLATFORM_DB, providerId, {
    ...(typeof displayNameRaw === "string" ? { displayName: displayNameRaw.trim() || null } : {}),
    ...((authTypeRaw === "oauth" || authTypeRaw === "api_key") ? { authType: authTypeRaw } : {}),
    ...(typeof apiBaseRaw === "string" && apiBaseRaw.trim().length > 0 ? { apiBase: apiBaseRaw.trim() } : {}),
    ...(typeof accessTokenRaw === "string" && accessTokenRaw.trim().length > 0 ? { accessToken: accessTokenRaw.trim() } : {}),
    ...(typeof enabledRaw === "boolean" ? { enabled: enabledRaw } : {}),
    ...(typeof priorityRaw === "number" && Number.isFinite(priorityRaw)
      ? { priority: Math.max(0, Math.floor(priorityRaw)) }
      : {})
  });

  const after = await getProviderAccountById(c.env.NEXTCLAW_PLATFORM_DB, providerId);
  if (!after) {
    return apiError(c, 500, "PROVIDER_NOT_FOUND_AFTER_UPDATE", "Provider cannot be loaded after update.");
  }

  if (changed) {
    await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
      actorUserId: admin.user.id,
      action: "admin.provider.update",
      targetType: "provider_account",
      targetId: providerId,
      beforeJson: JSON.stringify(toProviderAccountView(before)),
      afterJson: JSON.stringify(toProviderAccountView(after)),
      metadataJson: null
    });
  }

  return c.json({
    ok: true,
    data: {
      changed,
      provider: toProviderAccountView(after)
    }
  });
}

export async function adminModelsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const [models, providers] = await Promise.all([
    listModelCatalog(c.env.NEXTCLAW_PLATFORM_DB),
    listProviderAccounts(c.env.NEXTCLAW_PLATFORM_DB)
  ]);

  return c.json({
    ok: true,
    data: {
      items: models.map(toModelCatalogView),
      providers: providers.map(toProviderAccountView)
    }
  });
}

export async function putAdminModelHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const publicModelId = c.req.param("publicModelId").trim();
  if (publicModelId.length === 0) {
    return apiError(c, 400, "INVALID_MODEL_ID", "publicModelId is required.");
  }

  const body = await readJson(c);
  const providerAccountIdRaw = readUnknown(body, "providerAccountId");
  const upstreamModelRaw = readUnknown(body, "upstreamModel");
  const displayNameRaw = readUnknown(body, "displayName");
  const enabledRaw = readUnknown(body, "enabled");
  const sellInputRaw = readUnknown(body, "sellInputUsdPer1M");
  const sellOutputRaw = readUnknown(body, "sellOutputUsdPer1M");
  const upstreamInputRaw = readUnknown(body, "upstreamInputUsdPer1M");
  const upstreamOutputRaw = readUnknown(body, "upstreamOutputUsdPer1M");

  const providerAccountId = typeof providerAccountIdRaw === "string" ? providerAccountIdRaw.trim() : "";
  const upstreamModel = typeof upstreamModelRaw === "string" ? upstreamModelRaw.trim() : "";
  const displayName = typeof displayNameRaw === "string" ? displayNameRaw.trim() : "";
  const enabled = typeof enabledRaw === "boolean" ? enabledRaw : true;
  const sellInputUsdPer1M = typeof sellInputRaw === "number" && Number.isFinite(sellInputRaw) ? roundUsd(Math.max(0, sellInputRaw)) : Number.NaN;
  const sellOutputUsdPer1M = typeof sellOutputRaw === "number" && Number.isFinite(sellOutputRaw) ? roundUsd(Math.max(0, sellOutputRaw)) : Number.NaN;
  const upstreamInputUsdPer1M = typeof upstreamInputRaw === "number" && Number.isFinite(upstreamInputRaw) ? roundUsd(Math.max(0, upstreamInputRaw)) : Number.NaN;
  const upstreamOutputUsdPer1M = typeof upstreamOutputRaw === "number" && Number.isFinite(upstreamOutputRaw) ? roundUsd(Math.max(0, upstreamOutputRaw)) : Number.NaN;

  if (!providerAccountId) {
    return apiError(c, 400, "INVALID_PROVIDER_ACCOUNT", "providerAccountId is required.");
  }
  if (!upstreamModel) {
    return apiError(c, 400, "INVALID_UPSTREAM_MODEL", "upstreamModel is required.");
  }
  if (!Number.isFinite(sellInputUsdPer1M) || !Number.isFinite(sellOutputUsdPer1M) ||
    !Number.isFinite(upstreamInputUsdPer1M) || !Number.isFinite(upstreamOutputUsdPer1M)) {
    return apiError(c, 400, "INVALID_PRICING", "sell/upstream input and output prices must be non-negative numbers.");
  }

  const provider = await getProviderAccountById(c.env.NEXTCLAW_PLATFORM_DB, providerAccountId);
  if (!provider) {
    return apiError(c, 404, "PROVIDER_NOT_FOUND", "providerAccountId does not exist.");
  }

  await upsertModelCatalog(c.env.NEXTCLAW_PLATFORM_DB, {
    publicModelId,
    providerAccountId,
    upstreamModel,
    displayName: displayName.length > 0 ? displayName : null,
    enabled,
    sellInputUsdPer1M,
    sellOutputUsdPer1M,
    upstreamInputUsdPer1M,
    upstreamOutputUsdPer1M
  });

  const current = await listModelCatalog(c.env.NEXTCLAW_PLATFORM_DB);
  const model = current.find((item) => item.public_model_id === publicModelId);
  if (!model) {
    return apiError(c, 500, "MODEL_NOT_FOUND_AFTER_UPSERT", "Model cannot be loaded after upsert.");
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: admin.user.id,
    action: "admin.model.upsert",
    targetType: "model_catalog",
    targetId: publicModelId,
    beforeJson: null,
    afterJson: JSON.stringify(toModelCatalogView(model)),
    metadataJson: JSON.stringify({ providerAccountId, upstreamModel })
  });

  return c.json({
    ok: true,
    data: {
      model: toModelCatalogView(model)
    }
  });
}

export async function adminProfitOverviewHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const days = parseBoundedInt(c.req.query("days"), 1, 1, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const overview = await readProfitOverview(c.env.NEXTCLAW_PLATFORM_DB, since);
  const grossMarginRate = overview.totalChargeUsd > 0
    ? roundUsd(overview.totalGrossMarginUsd / overview.totalChargeUsd)
    : 0;

  return c.json({
    ok: true,
    data: {
      days,
      since,
      requests: overview.requests,
      totalChargeUsd: overview.totalChargeUsd,
      totalUpstreamCostUsd: overview.totalUpstreamCostUsd,
      totalGrossMarginUsd: overview.totalGrossMarginUsd,
      grossMarginRate
    }
  });
}

export async function adminUsersHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const limit = parseBoundedInt(c.req.query("limit"), 50, 1, 500);
  const query = optionalTrimmedString(c.req.query("q") ?? "");
  const cursor = decodeCursorToken(c.req.query("cursor"));

  const conditions: string[] = [];
  const binds: unknown[] = [];
  if (query) {
    conditions.push("email LIKE ?");
    binds.push(`%${query}%`);
  }
  if (cursor) {
    conditions.push("(created_at < ? OR (created_at = ? AND id < ?))");
    binds.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT id, email, password_hash, password_salt, role,
                      free_limit_usd, free_used_usd, paid_balance_usd,
                      created_at, updated_at
                 FROM users
                 ${whereClause}
                ORDER BY created_at DESC, id DESC
                LIMIT ?`;

  const result = await c.env.NEXTCLAW_PLATFORM_DB.prepare(sql)
    .bind(...binds, limit + 1)
    .all<UserRow>();
  const pagination = paginateRows(result.results ?? [], limit);

  return c.json({
    ok: true,
    data: {
      items: pagination.items.map(toUserPublicView),
      nextCursor: pagination.nextCursor,
      hasMore: pagination.hasMore
    }
  });
}

export async function patchAdminUserHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const userId = c.req.param("userId");
  const userBefore = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, userId);
  if (!userBefore) {
    return apiError(c, 404, "USER_NOT_FOUND", "User not found.");
  }

  const body = await readJson(c);
  const freeLimitUsdRaw = readUnknown(body, "freeLimitUsd");
  const paidBalanceDeltaUsdRaw = readUnknown(body, "paidBalanceDeltaUsd");

  let changed = false;
  const now = new Date().toISOString();

  if (typeof freeLimitUsdRaw === "number" && Number.isFinite(freeLimitUsdRaw) && freeLimitUsdRaw >= 0) {
    const nextFreeLimitUsd = roundUsd(freeLimitUsdRaw);
    const changedFree = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
      "UPDATE users SET free_limit_usd = ?, updated_at = ? WHERE id = ?"
    )
      .bind(nextFreeLimitUsd, now, userId)
      .run();
    if (changedFree.success && (changedFree.meta.changes ?? 0) > 0) {
      changed = true;
    }
  }

  if (typeof paidBalanceDeltaUsdRaw === "number" && Number.isFinite(paidBalanceDeltaUsdRaw) && paidBalanceDeltaUsdRaw !== 0) {
    const delta = roundUsd(paidBalanceDeltaUsdRaw);
    if (delta > 0) {
      const changedBalance = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
        "UPDATE users SET paid_balance_usd = paid_balance_usd + ?, updated_at = ? WHERE id = ?"
      )
        .bind(delta, now, userId)
        .run();
      if (changedBalance.success && (changedBalance.meta.changes ?? 0) > 0) {
        changed = true;
        await appendLedger(c.env.NEXTCLAW_PLATFORM_DB, {
          id: crypto.randomUUID(),
          userId,
          kind: "admin_adjust",
          amountUsd: roundUsd(delta),
          freeAmountUsd: 0,
          paidAmountUsd: roundUsd(delta),
          model: null,
          promptTokens: 0,
          completionTokens: 0,
          requestId: `admin-adjust:${crypto.randomUUID()}`,
          note: `Admin recharge +${delta.toFixed(6)} USD`
        });
      }
    }

    if (delta < 0) {
      const abs = Math.abs(delta);
      const changedBalance = await c.env.NEXTCLAW_PLATFORM_DB.prepare(
        "UPDATE users SET paid_balance_usd = paid_balance_usd - ?, updated_at = ? WHERE id = ? AND paid_balance_usd >= ?"
      )
        .bind(abs, now, userId, abs)
        .run();
      if (changedBalance.success && (changedBalance.meta.changes ?? 0) > 0) {
        changed = true;
        await appendLedger(c.env.NEXTCLAW_PLATFORM_DB, {
          id: crypto.randomUUID(),
          userId,
          kind: "admin_adjust",
          amountUsd: -roundUsd(abs),
          freeAmountUsd: 0,
          paidAmountUsd: -roundUsd(abs),
          model: null,
          promptTokens: 0,
          completionTokens: 0,
          requestId: `admin-adjust:${crypto.randomUUID()}`,
          note: `Admin deduction -${abs.toFixed(6)} USD`
        });
      }
    }
  }

  const userAfter = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, userId);
  if (!userAfter) {
    return apiError(c, 500, "USER_NOT_FOUND_AFTER_UPDATE", "User cannot be loaded after update.");
  }

  if (changed) {
    await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
      actorUserId: admin.user.id,
      action: "admin.user.quota.update",
      targetType: "user",
      targetId: userId,
      beforeJson: JSON.stringify(toUserPublicView(userBefore)),
      afterJson: JSON.stringify(toUserPublicView(userAfter)),
      metadataJson: JSON.stringify({
        freeLimitUsd: typeof freeLimitUsdRaw === "number" ? roundUsd(freeLimitUsdRaw) : null,
        paidBalanceDeltaUsd: typeof paidBalanceDeltaUsdRaw === "number" ? roundUsd(paidBalanceDeltaUsdRaw) : null
      })
    });
  }

  return c.json({
    ok: true,
    data: {
      changed,
      user: toUserPublicView(userAfter)
    }
  });
}

export async function adminRechargeIntentsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const status = optionalTrimmedString(c.req.query("status") ?? "");
  const limit = parseBoundedInt(c.req.query("limit"), 100, 1, 500);
  const cursor = decodeCursorToken(c.req.query("cursor"));

  const conditions: string[] = [];
  const binds: unknown[] = [];
  if (status && (status === "pending" || status === "confirmed" || status === "rejected")) {
    conditions.push("status = ?");
    binds.push(status);
  }
  if (cursor) {
    conditions.push("(created_at < ? OR (created_at = ? AND id < ?))");
    binds.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT id, user_id, amount_usd, status, note, created_at, updated_at,
                      confirmed_at, confirmed_by_user_id, rejected_at, rejected_by_user_id
                 FROM recharge_intents
                 ${whereClause}
                ORDER BY created_at DESC, id DESC
                LIMIT ?`;

  const rows = await c.env.NEXTCLAW_PLATFORM_DB.prepare(sql).bind(...binds, limit + 1).all<RechargeIntentRow>();
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

export async function patchAdminSettingsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const admin = await requireAdminUser(c);
  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJson(c);
  const globalFreeLimitUsdRaw = readNumber(body, "globalFreeLimitUsd");
  if (!Number.isFinite(globalFreeLimitUsdRaw) || globalFreeLimitUsdRaw < 0) {
    return apiError(c, 400, "INVALID_GLOBAL_LIMIT", "globalFreeLimitUsd must be a non-negative number.");
  }

  const nextLimit = roundUsd(globalFreeLimitUsdRaw);
  const prevLimit = await readPlatformNumberSetting(c.env.NEXTCLAW_PLATFORM_DB, "global_free_limit_usd", getGlobalFreeLimit(c.env));
  await writePlatformNumberSetting(c.env.NEXTCLAW_PLATFORM_DB, "global_free_limit_usd", nextLimit);

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: admin.user.id,
    action: "admin.settings.global_free_limit.update",
    targetType: "platform_settings",
    targetId: "global_free_limit_usd",
    beforeJson: JSON.stringify({ globalFreeLimitUsd: prevLimit }),
    afterJson: JSON.stringify({ globalFreeLimitUsd: nextLimit }),
    metadataJson: null
  });

  const currentUsed = await readPlatformNumberSetting(c.env.NEXTCLAW_PLATFORM_DB, "global_free_used_usd", 0);
  return c.json({
    ok: true,
    data: {
      globalFreeLimitUsd: roundUsd(nextLimit),
      globalFreeUsedUsd: roundUsd(currentUsed),
      globalFreeRemainingUsd: roundUsd(Math.max(0, nextLimit - currentUsed))
    }
  });
}
