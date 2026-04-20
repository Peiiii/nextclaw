import { appendLedger } from "@/repositories/platform.repository";
import { readUnknown, roundUsd } from "@/utils/platform.utils";

type AdminProviderCreateInput = {
  provider: string;
  authType: "api_key" | "oauth";
  apiBase: string;
  accessToken: string;
  displayName: string;
  enabled: boolean;
  priority: number;
};

type AdminModelUpsertInput = {
  providerAccountId: string;
  upstreamModel: string;
  displayName: string;
  enabled: boolean;
  sellInputUsdPer1M: number;
  sellOutputUsdPer1M: number;
  upstreamInputUsdPer1M: number;
  upstreamOutputUsdPer1M: number;
};

type AdminInputError = {
  code: string;
  message: string;
};

function readJsonRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }
  return body as Record<string, unknown>;
}

export function parseAdminProviderCreateInput(body: unknown): AdminProviderCreateInput {
  const record = readJsonRecord(body);
  const providerRaw = readUnknown(record, "provider");
  const authTypeRaw = readUnknown(record, "authType");
  const apiBaseRaw = readUnknown(record, "apiBase");
  const accessTokenRaw = readUnknown(record, "accessToken");
  const displayNameRaw = readUnknown(record, "displayName");
  const enabledRaw = readUnknown(record, "enabled");
  const priorityRaw = readUnknown(record, "priority");

  return {
    provider: typeof providerRaw === "string" ? providerRaw.trim() : "",
    authType: authTypeRaw === "api_key" ? "api_key" : "oauth",
    apiBase: typeof apiBaseRaw === "string" ? apiBaseRaw.trim() : "",
    accessToken: typeof accessTokenRaw === "string" ? accessTokenRaw.trim() : "",
    displayName: typeof displayNameRaw === "string" ? displayNameRaw.trim() : "",
    enabled: typeof enabledRaw === "boolean" ? enabledRaw : true,
    priority:
      typeof priorityRaw === "number" && Number.isFinite(priorityRaw)
        ? Math.max(0, Math.floor(priorityRaw))
        : 100,
  };
}

export function validateAdminProviderCreateInput(input: AdminProviderCreateInput): AdminInputError | null {
  if (!input.provider) {
    return { code: "INVALID_PROVIDER", message: "provider is required." };
  }
  if (!input.apiBase) {
    return { code: "INVALID_API_BASE", message: "apiBase is required." };
  }
  if (!input.accessToken) {
    return { code: "INVALID_ACCESS_TOKEN", message: "accessToken is required." };
  }
  return null;
}

export function parseAdminModelUpsertInput(body: unknown): AdminModelUpsertInput {
  const record = readJsonRecord(body);
  const providerAccountIdRaw = readUnknown(record, "providerAccountId");
  const upstreamModelRaw = readUnknown(record, "upstreamModel");
  const displayNameRaw = readUnknown(record, "displayName");
  const enabledRaw = readUnknown(record, "enabled");
  const sellInputRaw = readUnknown(record, "sellInputUsdPer1M");
  const sellOutputRaw = readUnknown(record, "sellOutputUsdPer1M");
  const upstreamInputRaw = readUnknown(record, "upstreamInputUsdPer1M");
  const upstreamOutputRaw = readUnknown(record, "upstreamOutputUsdPer1M");

  return {
    providerAccountId: typeof providerAccountIdRaw === "string" ? providerAccountIdRaw.trim() : "",
    upstreamModel: typeof upstreamModelRaw === "string" ? upstreamModelRaw.trim() : "",
    displayName: typeof displayNameRaw === "string" ? displayNameRaw.trim() : "",
    enabled: typeof enabledRaw === "boolean" ? enabledRaw : true,
    sellInputUsdPer1M:
      typeof sellInputRaw === "number" && Number.isFinite(sellInputRaw)
        ? roundUsd(Math.max(0, sellInputRaw))
        : Number.NaN,
    sellOutputUsdPer1M:
      typeof sellOutputRaw === "number" && Number.isFinite(sellOutputRaw)
        ? roundUsd(Math.max(0, sellOutputRaw))
        : Number.NaN,
    upstreamInputUsdPer1M:
      typeof upstreamInputRaw === "number" && Number.isFinite(upstreamInputRaw)
        ? roundUsd(Math.max(0, upstreamInputRaw))
        : Number.NaN,
    upstreamOutputUsdPer1M:
      typeof upstreamOutputRaw === "number" && Number.isFinite(upstreamOutputRaw)
        ? roundUsd(Math.max(0, upstreamOutputRaw))
        : Number.NaN,
  };
}

export function validateAdminModelUpsertInput(input: AdminModelUpsertInput): AdminInputError | null {
  if (!input.providerAccountId) {
    return { code: "INVALID_PROVIDER_ACCOUNT", message: "providerAccountId is required." };
  }
  if (!input.upstreamModel) {
    return { code: "INVALID_UPSTREAM_MODEL", message: "upstreamModel is required." };
  }
  if (
    !Number.isFinite(input.sellInputUsdPer1M) ||
    !Number.isFinite(input.sellOutputUsdPer1M) ||
    !Number.isFinite(input.upstreamInputUsdPer1M) ||
    !Number.isFinite(input.upstreamOutputUsdPer1M)
  ) {
    return {
      code: "INVALID_PRICING",
      message: "sell/upstream input and output prices must be non-negative numbers.",
    };
  }
  return null;
}

async function appendAdminBalanceLedger(params: {
  db: D1Database;
  userId: string;
  amountUsd: number;
  note: string;
}): Promise<void> {
  const { db, userId, amountUsd, note } = params;
  const normalizedAmount = roundUsd(amountUsd);
  await appendLedger(db, {
    id: crypto.randomUUID(),
    userId,
    kind: "admin_adjust",
    amountUsd: normalizedAmount,
    freeAmountUsd: 0,
    paidAmountUsd: normalizedAmount,
    model: null,
    promptTokens: 0,
    completionTokens: 0,
    requestId: `admin-adjust:${crypto.randomUUID()}`,
    note,
  });
}

export async function updateUserFreeLimit(params: {
  db: D1Database;
  userId: string;
  nextFreeLimitUsd: number;
  now: string;
}): Promise<boolean> {
  const { db, userId, nextFreeLimitUsd, now } = params;
  const changedFree = await db
    .prepare("UPDATE users SET free_limit_usd = ?, updated_at = ? WHERE id = ?")
    .bind(nextFreeLimitUsd, now, userId)
    .run();
  return changedFree.success && (changedFree.meta.changes ?? 0) > 0;
}

export async function applyUserBalanceDelta(params: {
  db: D1Database;
  userId: string;
  deltaUsd: number;
  now: string;
}): Promise<boolean> {
  const { db, userId, deltaUsd, now } = params;
  if (deltaUsd === 0) {
    return false;
  }

  if (deltaUsd > 0) {
    const changedBalance = await db
      .prepare("UPDATE users SET paid_balance_usd = paid_balance_usd + ?, updated_at = ? WHERE id = ?")
      .bind(deltaUsd, now, userId)
      .run();
    if (!(changedBalance.success && (changedBalance.meta.changes ?? 0) > 0)) {
      return false;
    }
    await appendAdminBalanceLedger({
      db,
      userId,
      amountUsd: deltaUsd,
      note: `Admin recharge +${deltaUsd.toFixed(6)} USD`,
    });
    return true;
  }

  const deductionUsd = Math.abs(deltaUsd);
  const changedBalance = await db
    .prepare(
      "UPDATE users SET paid_balance_usd = paid_balance_usd - ?, updated_at = ? WHERE id = ? AND paid_balance_usd >= ?",
    )
    .bind(deductionUsd, now, userId, deductionUsd)
    .run();
  if (!(changedBalance.success && (changedBalance.meta.changes ?? 0) > 0)) {
    return false;
  }
  await appendAdminBalanceLedger({
    db,
    userId,
    amountUsd: -deductionUsd,
    note: `Admin deduction -${deductionUsd.toFixed(6)} USD`,
  });
  return true;
}
