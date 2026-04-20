import {
  type BillingSnapshot,
  type ChargeResult,
  type ChargeSplit,
  type Env,
  type SupportedModelSpec,
  type UsageCounters,
  type UserRow
} from "@/types/platform";
import {
  appendLedger,
  getLedgerByRequestId,
  getUserById,
  readBillingSnapshot
} from "@/repositories/platform.repository";
import {
  extractUsageCounters,
  getGlobalFreeLimit,
  getRequestFlatUsdPerRequest,
  isRecord,
  jsonErrorResponse,
  openaiLikeUnauthorized,
  openaiLikeUnavailable,
  parseBearerToken,
  readAuthSecret,
  roundUsd,
  verifySessionToken
} from "@/utils/platform.utils";

const bootstrapReady = new WeakMap<D1Database, Promise<void>>();

export async function ensurePlatformBootstrap(env: Env): Promise<void> {
  const existing = bootstrapReady.get(env.NEXTCLAW_PLATFORM_DB);
  if (existing) {
    await existing;
    return;
  }

  const task = (async () => {
    const now = new Date().toISOString();
    await env.NEXTCLAW_PLATFORM_DB.batch([
      env.NEXTCLAW_PLATFORM_DB.prepare(
        "INSERT OR IGNORE INTO platform_settings (key, value, updated_at) VALUES ('global_free_limit_usd', ?, ?)"
      ).bind(String(getGlobalFreeLimit(env)), now),
      env.NEXTCLAW_PLATFORM_DB.prepare(
        "INSERT OR IGNORE INTO platform_settings (key, value, updated_at) VALUES ('global_free_used_usd', '0', ?)"
      ).bind(now)
    ]);
  })();

  bootstrapReady.set(env.NEXTCLAW_PLATFORM_DB, task);
  await task;
}

export async function requireAuthUser(c: { env: Env; req: { header: (name: string) => string | undefined } }): Promise<
  | { ok: true; user: UserRow }
  | { ok: false; response: Response }
> {
  const token = parseBearerToken(c.req.header("authorization"));
  if (!token) {
    return {
      ok: false,
      response: openaiLikeUnauthorized("Missing bearer token.")
    };
  }

  const secret = readAuthSecret(c.env);
  if (!secret) {
    return {
      ok: false,
      response: openaiLikeUnavailable("Auth secret is not configured.")
    };
  }

  const payload = await verifySessionToken(token, secret);
  if (!payload) {
    return {
      ok: false,
      response: openaiLikeUnauthorized("Invalid or expired token.")
    };
  }

  const user = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, payload.sub);
  if (!user) {
    return {
      ok: false,
      response: openaiLikeUnauthorized("Token subject no longer exists.")
    };
  }

  return { ok: true, user };
}

export async function requireAdminUser(c: { env: Env; req: { header: (name: string) => string | undefined } }): Promise<
  | { ok: true; user: UserRow }
  | { ok: false; response: Response }
> {
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth;
  }
  if (auth.user.role !== "admin") {
    return {
      ok: false,
      response: jsonErrorResponse(403, "FORBIDDEN", "Admin permission required.")
    };
  }
  return auth;
}

export async function chargeFromStream(params: {
  env: Env;
  userId: string;
  modelSpec: SupportedModelSpec;
  stream: ReadableStream;
  fallback: UsageCounters;
  requestId: string;
  onSettled?: (payload: { usage: UsageCounters; result: ChargeResult }) => Promise<void> | void;
}): Promise<void> {
  const { env, userId, modelSpec, stream, fallback, requestId, onSettled } = params;
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = "";
  let usage: UsageCounters | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    buffer += decoder.decode(value, { stream: true });
    const nextChunk = readStreamUsageChunk(buffer, usage ?? fallback);
    buffer = nextChunk.buffer;
    usage = nextChunk.usage;
  }

  const settledUsage = usage ?? fallback;
  const result = await chargeUsage(env, userId, modelSpec, settledUsage, requestId);
  if (onSettled) {
    await onSettled({ usage: settledUsage, result });
  }
}

export async function chargeUsage(
  env: Env,
  userId: string,
  modelSpec: SupportedModelSpec,
  usage: UsageCounters,
  requestId: string
): Promise<ChargeResult> {
  const db = env.NEXTCLAW_PLATFORM_DB;
  const existingLedger = await getLedgerByRequestId(db, userId, requestId);
  if (existingLedger) {
    return await buildExistingLedgerChargeResult(db, userId, existingLedger);
  }

  const totalCostUsd = roundUsd(calculateCost(modelSpec, usage) + getRequestFlatUsdPerRequest(env));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const attemptResult = await tryChargeUsageAttempt({
      db,
      userId,
      modelSpec,
      usage,
      requestId,
      totalCostUsd,
    });
    if (attemptResult === "retry") {
      continue;
    }
    return attemptResult;
  }

  const snapshot = await readBillingSnapshot(db, userId);
  if (!snapshot) {
    return buildInsufficientQuotaResult(userId);
  }

  return {
    ok: false,
    reason: "insufficient_quota",
    snapshot
  };
}

async function buildExistingLedgerChargeResult(
  db: D1Database,
  userId: string,
  existingLedger: NonNullable<Awaited<ReturnType<typeof getLedgerByRequestId>>>,
): Promise<ChargeResult> {
  return {
    ok: true,
    split: {
      totalCostUsd: roundUsd(Math.abs(existingLedger.amount_usd)),
      freePartUsd: roundUsd(existingLedger.free_amount_usd),
      paidPartUsd: roundUsd(existingLedger.paid_amount_usd),
    },
    snapshot: (await readBillingSnapshot(db, userId)) ?? buildEmptyBillingSnapshot(userId),
  };
}

function readStreamUsageChunk(
  buffer: string,
  fallback: UsageCounters,
): {
  buffer: string;
  usage: UsageCounters | null;
} {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  let usage: UsageCounters | null = null;

  for (const rawLine of lines) {
    const nextUsage = extractUsageFromSseLine(rawLine, usage ?? fallback);
    if (nextUsage) {
      usage = nextUsage;
    }
  }

  return {
    buffer: rest,
    usage,
  };
}

function extractUsageFromSseLine(line: string, fallback: UsageCounters): UsageCounters | null {
  const trimmedLine = line.trim();
  if (!trimmedLine.startsWith("data:")) {
    return null;
  }

  const data = trimmedLine.slice("data:".length).trim();
  if (data.length === 0 || data === "[DONE]") {
    return null;
  }

  try {
    const chunk = JSON.parse(data) as Record<string, unknown>;
    return isRecord(chunk.usage) ? extractUsageCounters(chunk, fallback) : null;
  } catch {
    return null;
  }
}

async function tryChargeUsageAttempt(params: {
  db: D1Database;
  userId: string;
  modelSpec: SupportedModelSpec;
  usage: UsageCounters;
  requestId: string;
  totalCostUsd: number;
}): Promise<ChargeResult | "retry"> {
  const { db, userId, modelSpec, usage, requestId, totalCostUsd } = params;
  const snapshot = await readBillingSnapshot(db, userId);
  if (!snapshot) {
    return buildInsufficientQuotaResult(userId);
  }

  const split = computeChargeSplit(snapshot, totalCostUsd);
  if (!split) {
    return {
      ok: false,
      reason: "insufficient_quota",
      snapshot,
    };
  }

  const now = new Date().toISOString();
  const userReserved = await reserveUserQuota(db, userId, split, now);
  if (!userReserved) {
    return "retry";
  }

  if (split.freePartUsd > 0) {
    const globalReserved = await reserveGlobalFreeQuota(
      db,
      split.freePartUsd,
      snapshot.globalFreeLimitUsd,
      now,
    );
    if (!globalReserved) {
      await rollbackUserQuota(db, userId, split, now);
      return "retry";
    }
  }

  const ledgerWritten = await writeUsageLedger(
    db,
    userId,
    split,
    modelSpec,
    usage,
    requestId,
  );
  if (!ledgerWritten) {
    await rollbackUserQuota(db, userId, split, now);
    await rollbackGlobalFreeQuota(db, split.freePartUsd, now);
    return "retry";
  }

  return {
    ok: true,
    split,
    snapshot,
  };
}

function buildEmptyBillingSnapshot(userId: string): BillingSnapshot {
  const epoch = new Date(0).toISOString();
  return {
    user: {
      id: userId,
      email: "",
      username: null,
      password_hash: "",
      password_salt: "",
      role: "user",
      free_limit_usd: 0,
      free_used_usd: 0,
      paid_balance_usd: 0,
      created_at: epoch,
      updated_at: epoch
    },
    globalFreeLimitUsd: 0,
    globalFreeUsedUsd: 0
  };
}

function buildInsufficientQuotaResult(userId: string): ChargeResult {
  return {
    ok: false,
    reason: "insufficient_quota",
    snapshot: buildEmptyBillingSnapshot(userId)
  };
}

async function reserveUserQuota(db: D1Database, userId: string, split: ChargeSplit, now: string): Promise<boolean> {
  const updateUser = await db.prepare(
    `UPDATE users
        SET free_used_usd = free_used_usd + ?,
            paid_balance_usd = paid_balance_usd - ?,
            updated_at = ?
      WHERE id = ?
        AND free_used_usd + ? <= free_limit_usd
        AND paid_balance_usd >= ?`
  )
    .bind(split.freePartUsd, split.paidPartUsd, now, userId, split.freePartUsd, split.paidPartUsd)
    .run();
  return updateUser.success && (updateUser.meta.changes ?? 0) === 1;
}

async function reserveGlobalFreeQuota(
  db: D1Database,
  freePartUsd: number,
  globalFreeLimitUsd: number,
  now: string
): Promise<boolean> {
  const updateGlobal = await db.prepare(
    `UPDATE platform_settings
        SET value = CAST(value AS REAL) + ?,
            updated_at = ?
      WHERE key = 'global_free_used_usd'
        AND CAST(value AS REAL) + ? <= ?`
  )
    .bind(freePartUsd, now, freePartUsd, globalFreeLimitUsd)
    .run();
  return updateGlobal.success && (updateGlobal.meta.changes ?? 0) === 1;
}

async function rollbackUserQuota(db: D1Database, userId: string, split: ChargeSplit, now: string): Promise<void> {
  await db.prepare(
    `UPDATE users
        SET free_used_usd = MAX(0, free_used_usd - ?),
            paid_balance_usd = paid_balance_usd + ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(split.freePartUsd, split.paidPartUsd, now, userId)
    .run();
}

async function rollbackGlobalFreeQuota(db: D1Database, freePartUsd: number, now: string): Promise<void> {
  if (freePartUsd <= 0) {
    return;
  }
  await db.prepare(
    `UPDATE platform_settings
        SET value = MAX(0, CAST(value AS REAL) - ?),
            updated_at = ?
      WHERE key = 'global_free_used_usd'`
  )
    .bind(freePartUsd, now)
    .run();
}

async function writeUsageLedger(
  db: D1Database,
  userId: string,
  split: ChargeSplit,
  modelSpec: SupportedModelSpec,
  usage: UsageCounters,
  requestId: string
): Promise<boolean> {
  try {
    await appendLedger(db, {
      id: crypto.randomUUID(),
      userId,
      kind: resolveUsageLedgerKind(split),
      amountUsd: -roundUsd(split.totalCostUsd),
      freeAmountUsd: roundUsd(split.freePartUsd),
      paidAmountUsd: roundUsd(split.paidPartUsd),
      model: modelSpec.id,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      requestId,
      note: null
    });
    return true;
  } catch {
    return false;
  }
}

export function resolveUsageLedgerKind(split: ChargeSplit): string {
  if (split.freePartUsd > 0 && split.paidPartUsd > 0) {
    return "usage_mixed";
  }
  if (split.freePartUsd > 0) {
    return "usage_free";
  }
  return "usage_paid";
}

export function computeChargeSplit(snapshot: BillingSnapshot, totalCostUsd: number): ChargeSplit | null {
  const freeRemainingUser = Math.max(0, snapshot.user.free_limit_usd - snapshot.user.free_used_usd);
  const freeRemainingGlobal = Math.max(0, snapshot.globalFreeLimitUsd - snapshot.globalFreeUsedUsd);
  const freeAvailable = Math.min(freeRemainingUser, freeRemainingGlobal);

  const freePartUsd = Math.min(totalCostUsd, freeAvailable);
  const paidPartUsd = roundUsd(totalCostUsd - freePartUsd);

  if (paidPartUsd > snapshot.user.paid_balance_usd + 1e-9) {
    return null;
  }

  return {
    totalCostUsd: roundUsd(totalCostUsd),
    freePartUsd: roundUsd(freePartUsd),
    paidPartUsd: roundUsd(Math.max(0, paidPartUsd))
  };
}

function calculateCost(modelSpec: SupportedModelSpec, usage: UsageCounters): number {
  return (usage.promptTokens / 1_000_000) * modelSpec.inputUsdPer1M +
    (usage.completionTokens / 1_000_000) * modelSpec.outputUsdPer1M;
}
