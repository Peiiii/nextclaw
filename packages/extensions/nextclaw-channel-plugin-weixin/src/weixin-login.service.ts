import { randomUUID } from "node:crypto";
import { saveWeixinAccount } from "./weixin-account.store.js";
import { fetchWeixinQrCode, fetchWeixinQrStatus } from "./weixin-api.client.js";
import {
  buildLoggedInWeixinPluginConfig,
  DEFAULT_WEIXIN_BASE_URL,
  WEIXIN_CHANNEL_ID,
  normalizeWeixinPluginConfig,
  type WeixinPluginConfig,
} from "./weixin-config.js";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

const WEIXIN_LOGIN_TIMEOUT_MS = 8 * 60_000;
const WEIXIN_AUTH_POLL_INTERVAL_MS = 2_000;

type WeixinLoginParams = {
  pluginConfig?: Record<string, unknown>;
  requestedAccountId?: string | null;
  baseUrl?: string | null;
  verbose?: boolean;
};

type WeixinLoginResult = { pluginConfig: Record<string, unknown>; accountId?: string | null; notes?: string[] };

type WeixinAuthStartResult = {
  channel: string;
  kind: "qr_code";
  sessionId: string;
  qrCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  intervalMs: number;
  note?: string;
};

type WeixinAuthPollResult = {
  channel: string;
  status: "pending" | "scanned" | "authorized" | "expired" | "error";
  message?: string;
  nextPollMs?: number;
  accountId?: string | null;
  notes?: string[];
  pluginConfig?: Record<string, unknown>;
};

type WeixinLoginSession = {
  sessionId: string;
  currentPluginConfig: WeixinPluginConfig;
  requestedAccountId?: string | null;
  baseUrl: string;
  qrCode: string;
  qrCodeUrl: string;
  expiresAtMs: number;
};

const weixinLoginSessions = new Map<string, WeixinLoginSession>();

function resolveWeixinLoginBaseUrl(params: WeixinLoginParams, currentPluginConfig: WeixinPluginConfig): string {
  return params.baseUrl?.trim() || currentPluginConfig.baseUrl || DEFAULT_WEIXIN_BASE_URL;
}

function printWeixinLoginInstructions(qrCodeUrl: string): void {
  console.log("使用微信扫描以下二维码链接完成连接：");
  console.log(qrCodeUrl);
  console.log("");
  console.log("等待扫码确认...");
}

function cleanupExpiredWeixinLoginSessions(now = Date.now()): void {
  for (const [sessionId, session] of weixinLoginSessions.entries()) {
    if (session.expiresAtMs <= now) {
      weixinLoginSessions.delete(sessionId);
    }
  }
}

function buildConfirmedLoginResult(params: {
  currentPluginConfig: WeixinPluginConfig;
  requestedAccountId?: string | null;
  fallbackBaseUrl: string;
  status: Awaited<ReturnType<typeof fetchWeixinQrStatus>>;
}): WeixinLoginResult {
  const botToken = params.status.bot_token?.trim();
  const actualAccountId = params.status.ilink_bot_id?.trim() || params.requestedAccountId?.trim();
  const resolvedBaseUrl = params.status.baseurl?.trim() || params.fallbackBaseUrl;
  const authorizedUserId = params.status.ilink_user_id?.trim() || undefined;

  if (!botToken || !actualAccountId) {
    throw new Error("weixin login failed: missing bot token or account id");
  }

  saveWeixinAccount({
    accountId: actualAccountId,
    token: botToken,
    baseUrl: resolvedBaseUrl,
    userId: authorizedUserId,
    savedAt: new Date().toISOString(),
  });

  const notes: string[] = [];
  if (params.requestedAccountId?.trim() && params.requestedAccountId.trim() !== actualAccountId) {
    notes.push(`Weixin account resolved to ${actualAccountId}.`);
  }
  if (authorizedUserId) {
    notes.push(`Authorized initial user: ${authorizedUserId}`);
  }

  return {
    pluginConfig: buildLoggedInWeixinPluginConfig({
      pluginConfig: params.currentPluginConfig,
      accountId: actualAccountId,
      baseUrl: resolvedBaseUrl,
      allowUserId: authorizedUserId,
    }) as Record<string, unknown>,
    accountId: actualAccountId,
    notes,
  };
}

export async function startWeixinLoginSession(params: WeixinLoginParams): Promise<WeixinAuthStartResult> {
  cleanupExpiredWeixinLoginSessions();
  const currentPluginConfig: WeixinPluginConfig = normalizeWeixinPluginConfig(params.pluginConfig);
  const baseUrl = resolveWeixinLoginBaseUrl(params, currentPluginConfig);
  const qrCode = await fetchWeixinQrCode({ baseUrl });
  const qrCodeUrl = qrCode.qrcode_img_content?.trim();
  const qrCodeValue = qrCode.qrcode?.trim();

  if (!qrCodeUrl || !qrCodeValue) {
    throw new Error("weixin login failed: QR code is unavailable");
  }

  const sessionId = randomUUID();
  const expiresAtMs = Date.now() + WEIXIN_LOGIN_TIMEOUT_MS;
  weixinLoginSessions.set(sessionId, {
    sessionId,
    currentPluginConfig,
    requestedAccountId: params.requestedAccountId,
    baseUrl,
    qrCode: qrCodeValue,
    qrCodeUrl,
    expiresAtMs,
  });

  return {
    channel: WEIXIN_CHANNEL_ID,
    kind: "qr_code",
    sessionId,
    qrCode: qrCodeValue,
    qrCodeUrl,
    expiresAt: new Date(expiresAtMs).toISOString(),
    intervalMs: WEIXIN_AUTH_POLL_INTERVAL_MS,
    note: "请使用微信扫码，并在手机上确认登录。"
  };
}

export async function pollWeixinLoginSession(params: {
  sessionId: string;
}): Promise<WeixinAuthPollResult | null> {
  cleanupExpiredWeixinLoginSessions();
  const session = weixinLoginSessions.get(params.sessionId);
  if (!session) {
    return null;
  }
  if (session.expiresAtMs <= Date.now()) {
    weixinLoginSessions.delete(params.sessionId);
    return {
      channel: WEIXIN_CHANNEL_ID,
      status: "expired",
      message: "二维码已过期，请重新扫码。"
    };
  }

  try {
    const status = await fetchWeixinQrStatus({
      baseUrl: session.baseUrl,
      qrcode: session.qrCode,
    });

    if (status.status === "scaned") {
      return {
        channel: WEIXIN_CHANNEL_ID,
        status: "scanned",
        message: "二维码已扫码，请在微信中确认登录。",
        nextPollMs: WEIXIN_AUTH_POLL_INTERVAL_MS
      };
    }

    if (status.status === "confirmed") {
      const result = buildConfirmedLoginResult({
        currentPluginConfig: session.currentPluginConfig,
        requestedAccountId: session.requestedAccountId,
        fallbackBaseUrl: session.baseUrl,
        status,
      });
      weixinLoginSessions.delete(params.sessionId);
      return {
        channel: WEIXIN_CHANNEL_ID,
        status: "authorized",
        message: "微信已连接。",
        nextPollMs: 0,
        accountId: result.accountId,
        notes: result.notes,
        pluginConfig: result.pluginConfig,
      };
    }

    if (status.status === "expired") {
      weixinLoginSessions.delete(params.sessionId);
      return {
        channel: WEIXIN_CHANNEL_ID,
        status: "expired",
        message: "二维码已过期，请重新扫码。"
      };
    }

    return {
      channel: WEIXIN_CHANNEL_ID,
      status: "pending",
      nextPollMs: WEIXIN_AUTH_POLL_INTERVAL_MS
    };
  } catch (error) {
    return {
      channel: WEIXIN_CHANNEL_ID,
      status: "error",
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function loginWeixinChannel(params: {
  pluginConfig?: Record<string, unknown>;
  requestedAccountId?: string | null;
  baseUrl?: string | null;
  verbose?: boolean;
}): Promise<{ pluginConfig: Record<string, unknown>; accountId?: string | null; notes?: string[] }> {
  const startResult = await startWeixinLoginSession(params);
  printWeixinLoginInstructions(startResult.qrCodeUrl);

  let seenScanned = false;

  while (Date.now() < new Date(startResult.expiresAt).getTime()) {
    const status = await pollWeixinLoginSession({ sessionId: startResult.sessionId });
    if (!status) {
      throw new Error("weixin login failed: auth session not found");
    }

    if (status.status === "scanned" && !seenScanned) {
      console.log(status.message ?? "二维码已扫码，请在微信中确认登录。");
      seenScanned = true;
    }

    if (status.status === "authorized") {
      return {
        pluginConfig: status.pluginConfig ?? {},
        accountId: status.accountId,
        notes: status.notes,
      };
    }

    if (status.status === "expired") {
      throw new Error(status.message ?? "weixin login failed: QR code expired, please retry");
    }

    if (status.status === "error") {
      throw new Error(status.message ?? "weixin login failed");
    }

    if (params.verbose) {
      process.stdout.write(".");
    }
    await sleep(status.nextPollMs ?? WEIXIN_AUTH_POLL_INTERVAL_MS);
  }

  throw new Error("weixin login timed out");
}
