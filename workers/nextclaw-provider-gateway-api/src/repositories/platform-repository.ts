import {
  DEFAULT_GLOBAL_FREE_USD_LIMIT,
  type BillingSnapshot,
  type LedgerRow,
  type ModelCatalogRow,
  type ModelCatalogView,
  type ProviderAccountRow,
  type ProviderAccountView,
  type RechargeIntentRow,
  type RuntimeModelSpec,
  type UserPublicView,
  type UserRow,
  type UserSecurityRow
} from "../types/platform";
import { normalizeNonNegativeInteger, roundUsd } from "../utils/platform-utils";

export async function appendLedger(
  db: D1Database,
  payload: {
    id: string;
    userId: string;
    kind: string;
    amountUsd: number;
    freeAmountUsd: number;
    paidAmountUsd: number;
    model: string | null;
    promptTokens: number;
    completionTokens: number;
    requestId: string | null;
    note: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const result = await db.prepare(
    `INSERT INTO usage_ledger (
      id, user_id, kind, amount_usd, free_amount_usd, paid_amount_usd,
      model, prompt_tokens, completion_tokens, request_id, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      payload.id,
      payload.userId,
      payload.kind,
      payload.amountUsd,
      payload.freeAmountUsd,
      payload.paidAmountUsd,
      payload.model,
      payload.promptTokens,
      payload.completionTokens,
      payload.requestId,
      payload.note,
      now
    )
    .run();
  if (!result.success || (result.meta.changes ?? 0) !== 1) {
    throw new Error("APPEND_LEDGER_FAILED");
  }
}

export async function getLedgerByRequestId(db: D1Database, userId: string, requestId: string): Promise<LedgerRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, kind, amount_usd, free_amount_usd, paid_amount_usd,
            model, prompt_tokens, completion_tokens, request_id, note, created_at
       FROM usage_ledger
      WHERE user_id = ? AND request_id = ?
      LIMIT 1`
  )
    .bind(userId, requestId)
    .first<LedgerRow>();
  return row ?? null;
}

export async function appendAuditLog(
  db: D1Database,
  payload: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string | null;
    beforeJson: string | null;
    afterJson: string | null;
    metadataJson: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id,
      before_json, after_json, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      payload.actorUserId,
      payload.action,
      payload.targetType,
      payload.targetId,
      payload.beforeJson,
      payload.afterJson,
      payload.metadataJson,
      now
    )
    .run();
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  const row = await db.prepare(
    `SELECT id, email, password_hash, password_salt, role,
            free_limit_usd, free_used_usd, paid_balance_usd,
            created_at, updated_at
       FROM users
      WHERE id = ?`
  )
    .bind(id)
    .first<UserRow>();
  return row ?? null;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const row = await db.prepare(
    `SELECT id, email, password_hash, password_salt, role,
            free_limit_usd, free_used_usd, paid_balance_usd,
            created_at, updated_at
       FROM users
      WHERE email = ?`
  )
    .bind(email)
    .first<UserRow>();
  return row ?? null;
}

export async function ensureUserSecurityRow(db: D1Database, userId: string, nowIso: string): Promise<UserSecurityRow> {
  await db.prepare(
    `INSERT OR IGNORE INTO user_security (user_id, failed_login_attempts, login_locked_until, updated_at)
     VALUES (?, 0, NULL, ?)`
  )
    .bind(userId, nowIso)
    .run();

  const row = await db.prepare(
    `SELECT user_id, failed_login_attempts, login_locked_until, updated_at
       FROM user_security
      WHERE user_id = ?`
  )
    .bind(userId)
    .first<UserSecurityRow>();

  if (row) {
    return row;
  }

  return {
    user_id: userId,
    failed_login_attempts: 0,
    login_locked_until: null,
    updated_at: nowIso
  };
}

export async function registerUserLoginFailure(
  db: D1Database,
  userId: string,
  nowIso: string,
  maxFailedAttemptsPerUser: number,
  accountLockMinutes: number
): Promise<{ lockedUntil: string | null }> {
  const current = await ensureUserSecurityRow(db, userId, nowIso);
  const nextFailed = normalizeNonNegativeInteger(current.failed_login_attempts) + 1;
  if (nextFailed >= maxFailedAttemptsPerUser) {
    const lockedUntil = new Date(Date.now() + accountLockMinutes * 60_000).toISOString();
    await db.prepare(
      `UPDATE user_security
          SET failed_login_attempts = 0,
              login_locked_until = ?,
              updated_at = ?
        WHERE user_id = ?`
    )
      .bind(lockedUntil, nowIso, userId)
      .run();
    return { lockedUntil };
  }

  await db.prepare(
    `UPDATE user_security
        SET failed_login_attempts = ?,
            updated_at = ?
      WHERE user_id = ?`
  )
    .bind(nextFailed, nowIso, userId)
    .run();
  return { lockedUntil: null };
}

export async function resetUserLoginSecurity(db: D1Database, userId: string, nowIso: string): Promise<void> {
  await db.prepare(
    `UPDATE user_security
        SET failed_login_attempts = 0,
            login_locked_until = NULL,
            updated_at = ?
      WHERE user_id = ?`
  )
    .bind(nowIso, userId)
    .run();
}

export async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(1) AS count FROM users").first<{ count: number }>();
  return normalizeNonNegativeInteger(row?.count ?? 0);
}

export async function countRechargeIntentsByStatus(
  db: D1Database,
  status: "pending" | "confirmed" | "rejected"
): Promise<number> {
  const row = await db.prepare("SELECT COUNT(1) AS count FROM recharge_intents WHERE status = ?")
    .bind(status)
    .first<{ count: number }>();
  return normalizeNonNegativeInteger(row?.count ?? 0);
}

export async function getRechargeIntentById(db: D1Database, id: string): Promise<RechargeIntentRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, amount_usd, status, note, created_at, updated_at,
            confirmed_at, confirmed_by_user_id, rejected_at, rejected_by_user_id
       FROM recharge_intents
      WHERE id = ?`
  )
    .bind(id)
    .first<RechargeIntentRow>();
  return row ?? null;
}

export async function appendLoginAttempt(
  db: D1Database,
  payload: {
    email: string;
    ip: string | null;
    success: boolean;
    reason: string | null;
    createdAt: string;
  }
): Promise<void> {
  await db.prepare(
    `INSERT INTO login_attempts (
      id, email, ip, success, reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      payload.email,
      payload.ip,
      payload.success ? 1 : 0,
      payload.reason,
      payload.createdAt
    )
    .run();
}

export async function countRecentFailedLoginsByIp(db: D1Database, ip: string, sinceIso: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(1) AS count
       FROM login_attempts
      WHERE ip = ?
        AND success = 0
        AND created_at >= ?`
  )
    .bind(ip, sinceIso)
    .first<{ count: number }>();
  return normalizeNonNegativeInteger(row?.count ?? 0);
}

export async function listProviderAccounts(db: D1Database): Promise<ProviderAccountRow[]> {
  const rows = await db.prepare(
    `SELECT id, provider, display_name, auth_type, api_base, access_token,
            enabled, priority, created_at, updated_at
       FROM provider_accounts
      ORDER BY priority ASC, created_at ASC`
  ).all<ProviderAccountRow>();
  return rows.results ?? [];
}

export async function getProviderAccountById(db: D1Database, id: string): Promise<ProviderAccountRow | null> {
  const row = await db.prepare(
    `SELECT id, provider, display_name, auth_type, api_base, access_token,
            enabled, priority, created_at, updated_at
       FROM provider_accounts
      WHERE id = ?`
  )
    .bind(id)
    .first<ProviderAccountRow>();
  return row ?? null;
}

export async function createProviderAccount(
  db: D1Database,
  payload: {
    id: string;
    provider: string;
    displayName: string | null;
    authType: "oauth" | "api_key";
    apiBase: string;
    accessToken: string;
    enabled: boolean;
    priority: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const result = await db.prepare(
    `INSERT INTO provider_accounts (
      id, provider, display_name, auth_type, api_base, access_token,
      enabled, priority, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      payload.id,
      payload.provider,
      payload.displayName,
      payload.authType,
      payload.apiBase,
      payload.accessToken,
      payload.enabled ? 1 : 0,
      payload.priority,
      now,
      now
    )
    .run();
  if (!result.success || (result.meta.changes ?? 0) !== 1) {
    throw new Error("CREATE_PROVIDER_ACCOUNT_FAILED");
  }
}

export async function patchProviderAccount(
  db: D1Database,
  id: string,
  payload: {
    displayName?: string | null;
    authType?: "oauth" | "api_key";
    apiBase?: string;
    accessToken?: string;
    enabled?: boolean;
    priority?: number;
  }
): Promise<boolean> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (payload.displayName !== undefined) {
    sets.push("display_name = ?");
    binds.push(payload.displayName);
  }
  if (payload.authType !== undefined) {
    sets.push("auth_type = ?");
    binds.push(payload.authType);
  }
  if (payload.apiBase !== undefined) {
    sets.push("api_base = ?");
    binds.push(payload.apiBase);
  }
  if (payload.accessToken !== undefined) {
    sets.push("access_token = ?");
    binds.push(payload.accessToken);
  }
  if (payload.enabled !== undefined) {
    sets.push("enabled = ?");
    binds.push(payload.enabled ? 1 : 0);
  }
  if (payload.priority !== undefined) {
    sets.push("priority = ?");
    binds.push(payload.priority);
  }
  if (sets.length === 0) {
    return false;
  }
  sets.push("updated_at = ?");
  binds.push(new Date().toISOString(), id);
  const result = await db.prepare(
    `UPDATE provider_accounts
        SET ${sets.join(", ")}
      WHERE id = ?`
  )
    .bind(...binds)
    .run();
  return result.success && (result.meta.changes ?? 0) > 0;
}

export async function listModelCatalog(db: D1Database): Promise<ModelCatalogRow[]> {
  const rows = await db.prepare(
    `SELECT public_model_id, provider_account_id, upstream_model, display_name, enabled,
            sell_input_usd_per_1m, sell_output_usd_per_1m,
            upstream_input_usd_per_1m, upstream_output_usd_per_1m,
            created_at, updated_at
       FROM model_catalog
      ORDER BY public_model_id ASC`
  ).all<ModelCatalogRow>();
  return rows.results ?? [];
}

export async function getModelCatalogByPublicModelId(
  db: D1Database,
  publicModelId: string
): Promise<ModelCatalogRow | null> {
  const row = await db.prepare(
    `SELECT public_model_id, provider_account_id, upstream_model, display_name, enabled,
            sell_input_usd_per_1m, sell_output_usd_per_1m,
            upstream_input_usd_per_1m, upstream_output_usd_per_1m,
            created_at, updated_at
       FROM model_catalog
      WHERE public_model_id = ?`
  )
    .bind(publicModelId)
    .first<ModelCatalogRow>();
  return row ?? null;
}

export async function upsertModelCatalog(
  db: D1Database,
  payload: {
    publicModelId: string;
    providerAccountId: string;
    upstreamModel: string;
    displayName: string | null;
    enabled: boolean;
    sellInputUsdPer1M: number;
    sellOutputUsdPer1M: number;
    upstreamInputUsdPer1M: number;
    upstreamOutputUsdPer1M: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO model_catalog (
      public_model_id, provider_account_id, upstream_model, display_name, enabled,
      sell_input_usd_per_1m, sell_output_usd_per_1m,
      upstream_input_usd_per_1m, upstream_output_usd_per_1m,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(public_model_id) DO UPDATE SET
      provider_account_id = excluded.provider_account_id,
      upstream_model = excluded.upstream_model,
      display_name = excluded.display_name,
      enabled = excluded.enabled,
      sell_input_usd_per_1m = excluded.sell_input_usd_per_1m,
      sell_output_usd_per_1m = excluded.sell_output_usd_per_1m,
      upstream_input_usd_per_1m = excluded.upstream_input_usd_per_1m,
      upstream_output_usd_per_1m = excluded.upstream_output_usd_per_1m,
      updated_at = excluded.updated_at`
  )
    .bind(
      payload.publicModelId,
      payload.providerAccountId,
      payload.upstreamModel,
      payload.displayName,
      payload.enabled ? 1 : 0,
      payload.sellInputUsdPer1M,
      payload.sellOutputUsdPer1M,
      payload.upstreamInputUsdPer1M,
      payload.upstreamOutputUsdPer1M,
      now,
      now
    )
    .run();
}

export async function listRuntimeModelSpecs(db: D1Database): Promise<RuntimeModelSpec[]> {
  const rows = await db.prepare(
    `SELECT m.public_model_id, m.upstream_model, m.display_name,
            m.sell_input_usd_per_1m, m.sell_output_usd_per_1m,
            m.upstream_input_usd_per_1m, m.upstream_output_usd_per_1m,
            p.id AS provider_account_id, p.api_base, p.access_token
       FROM model_catalog m
       JOIN provider_accounts p ON p.id = m.provider_account_id
      WHERE m.enabled = 1
        AND p.enabled = 1
      ORDER BY p.priority ASC, m.public_model_id ASC`
  ).all<{
    public_model_id: string;
    upstream_model: string;
    display_name: string | null;
    sell_input_usd_per_1m: number;
    sell_output_usd_per_1m: number;
    upstream_input_usd_per_1m: number;
    upstream_output_usd_per_1m: number;
    provider_account_id: string;
    api_base: string;
    access_token: string;
  }>();
  return (rows.results ?? []).map((row) => ({
    id: row.public_model_id,
    displayName: row.display_name ?? row.public_model_id,
    upstreamModel: row.upstream_model,
    apiBase: row.api_base,
    accessToken: row.access_token,
    providerAccountId: row.provider_account_id,
    sellInputUsdPer1M: roundUsd(row.sell_input_usd_per_1m),
    sellOutputUsdPer1M: roundUsd(row.sell_output_usd_per_1m),
    upstreamInputUsdPer1M: roundUsd(row.upstream_input_usd_per_1m),
    upstreamOutputUsdPer1M: roundUsd(row.upstream_output_usd_per_1m)
  }));
}

export async function appendProfitLedger(
  db: D1Database,
  payload: {
    requestId: string;
    userId: string;
    publicModelId: string;
    providerAccountId: string | null;
    upstreamModel: string;
    chargeUsd: number;
    upstreamCostUsd: number;
    grossMarginUsd: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT OR REPLACE INTO request_profit_ledger (
      id, request_id, user_id, public_model_id, provider_account_id,
      upstream_model, charge_usd, upstream_cost_usd, gross_margin_usd, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      payload.requestId,
      payload.userId,
      payload.publicModelId,
      payload.providerAccountId,
      payload.upstreamModel,
      roundUsd(payload.chargeUsd),
      roundUsd(payload.upstreamCostUsd),
      roundUsd(payload.grossMarginUsd),
      now
    )
    .run();
}

export async function readProfitOverview(
  db: D1Database,
  sinceIso: string
): Promise<{ totalChargeUsd: number; totalUpstreamCostUsd: number; totalGrossMarginUsd: number; requests: number }> {
  const row = await db.prepare(
    `SELECT
       COALESCE(SUM(charge_usd), 0) AS total_charge_usd,
       COALESCE(SUM(upstream_cost_usd), 0) AS total_upstream_cost_usd,
       COALESCE(SUM(gross_margin_usd), 0) AS total_gross_margin_usd,
       COUNT(1) AS requests
     FROM request_profit_ledger
     WHERE created_at >= ?`
  )
    .bind(sinceIso)
    .first<{
      total_charge_usd: number;
      total_upstream_cost_usd: number;
      total_gross_margin_usd: number;
      requests: number;
    }>();
  return {
    totalChargeUsd: roundUsd(row?.total_charge_usd ?? 0),
    totalUpstreamCostUsd: roundUsd(row?.total_upstream_cost_usd ?? 0),
    totalGrossMarginUsd: roundUsd(row?.total_gross_margin_usd ?? 0),
    requests: normalizeNonNegativeInteger(row?.requests ?? 0)
  };
}

export async function writePlatformNumberSetting(db: D1Database, key: string, value: number): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(key, String(roundUsd(value)), now)
    .run();
}

export async function readPlatformNumberSetting(db: D1Database, key: string, fallback: number): Promise<number> {
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (!row) {
    return fallback;
  }
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function readBillingSnapshot(db: D1Database, userId: string): Promise<BillingSnapshot | null> {
  const user = await getUserById(db, userId);
  if (!user) {
    return null;
  }
  const globalFreeLimitUsd = await readPlatformNumberSetting(db, "global_free_limit_usd", DEFAULT_GLOBAL_FREE_USD_LIMIT);
  const globalFreeUsedUsd = await readPlatformNumberSetting(db, "global_free_used_usd", 0);
  return {
    user,
    globalFreeLimitUsd,
    globalFreeUsedUsd
  };
}

export function toUserPublicView(user: UserRow): UserPublicView {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    freeLimitUsd: roundUsd(user.free_limit_usd),
    freeUsedUsd: roundUsd(user.free_used_usd),
    freeRemainingUsd: roundUsd(Math.max(0, user.free_limit_usd - user.free_used_usd)),
    paidBalanceUsd: roundUsd(user.paid_balance_usd),
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

export function toBillingOverview(snapshot: BillingSnapshot): {
  user: UserPublicView;
  globalFreeLimitUsd: number;
  globalFreeUsedUsd: number;
  globalFreeRemainingUsd: number;
} {
  return {
    user: toUserPublicView(snapshot.user),
    globalFreeLimitUsd: roundUsd(snapshot.globalFreeLimitUsd),
    globalFreeUsedUsd: roundUsd(snapshot.globalFreeUsedUsd),
    globalFreeRemainingUsd: roundUsd(Math.max(0, snapshot.globalFreeLimitUsd - snapshot.globalFreeUsedUsd))
  };
}

export function toLedgerView(row: LedgerRow): {
  id: string;
  userId: string;
  kind: string;
  amountUsd: number;
  freeAmountUsd: number;
  paidAmountUsd: number;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  requestId: string | null;
  note: string | null;
  createdAt: string;
} {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    amountUsd: roundUsd(row.amount_usd),
    freeAmountUsd: roundUsd(row.free_amount_usd),
    paidAmountUsd: roundUsd(row.paid_amount_usd),
    model: row.model,
    promptTokens: normalizeNonNegativeInteger(row.prompt_tokens),
    completionTokens: normalizeNonNegativeInteger(row.completion_tokens),
    requestId: row.request_id,
    note: row.note,
    createdAt: row.created_at
  };
}

export function toRechargeIntentView(row: RechargeIntentRow): {
  id: string;
  userId: string;
  amountUsd: number;
  status: "pending" | "confirmed" | "rejected";
  note: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  confirmedByUserId: string | null;
  rejectedAt: string | null;
  rejectedByUserId: string | null;
} {
  return {
    id: row.id,
    userId: row.user_id,
    amountUsd: roundUsd(row.amount_usd),
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    confirmedByUserId: row.confirmed_by_user_id,
    rejectedAt: row.rejected_at,
    rejectedByUserId: row.rejected_by_user_id
  };
}

export function toProviderAccountView(row: ProviderAccountRow): ProviderAccountView {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    authType: row.auth_type,
    apiBase: row.api_base,
    tokenSet: row.access_token.trim().length > 0,
    enabled: row.enabled === 1,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toModelCatalogView(row: ModelCatalogRow): ModelCatalogView {
  return {
    publicModelId: row.public_model_id,
    providerAccountId: row.provider_account_id,
    upstreamModel: row.upstream_model,
    displayName: row.display_name,
    enabled: row.enabled === 1,
    sellInputUsdPer1M: roundUsd(row.sell_input_usd_per_1m),
    sellOutputUsdPer1M: roundUsd(row.sell_output_usd_per_1m),
    upstreamInputUsdPer1M: roundUsd(row.upstream_input_usd_per_1m),
    upstreamOutputUsdPer1M: roundUsd(row.upstream_output_usd_per_1m),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
