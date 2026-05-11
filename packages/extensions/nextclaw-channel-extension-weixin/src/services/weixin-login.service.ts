import { randomUUID } from "node:crypto";
import { FileWeixinAccountStore, type WeixinAccountStore } from "../stores/weixin-account.store.js";
import { HttpWeixinApiClient, type WeixinApiClient, type WeixinQrStatusResponse } from "./weixin-api.service.js";
import {
  buildLoggedInWeixinChannelConfig,
  DEFAULT_WEIXIN_BASE_URL,
  normalizeWeixinChannelConfig,
  WEIXIN_CHANNEL_ID,
} from "../utils/weixin-config.utils.js";
import type { WeixinChannelConfig } from "../types/weixin-extension.types.js";

export type WeixinLoginParams = {
  pluginConfig?: Record<string, unknown>;
  requestedAccountId?: string | null;
  baseUrl?: string | null;
  verbose?: boolean;
};

export type WeixinAuthStartResult = {
  channel: string;
  kind: "qr_code";
  sessionId: string;
  qrCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  intervalMs: number;
  note?: string;
};

export type WeixinAuthPollResult = {
  channel: string;
  status: "pending" | "scanned" | "authorized" | "expired" | "error";
  message?: string;
  nextPollMs?: number;
  accountId?: string | null;
  notes?: string[];
  pluginConfig?: Record<string, unknown>;
};

type WeixinLoginSession = {
  currentConfig: WeixinChannelConfig;
  requestedAccountId?: string | null;
  baseUrl: string;
  qrCode: string;
  expiresAtMs: number;
};

type WeixinLoginServiceDeps = {
  api?: WeixinApiClient;
  store?: WeixinAccountStore;
};

const WEIXIN_LOGIN_TIMEOUT_MS = 8 * 60_000;
const WEIXIN_AUTH_POLL_INTERVAL_MS = 2_000;
const WEIXIN_AUTH_STATUS_TIMEOUT_MS = 5_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function resolveLoginBaseUrl(params: WeixinLoginParams, currentConfig: WeixinChannelConfig): string {
  return params.baseUrl?.trim() || currentConfig.baseUrl || DEFAULT_WEIXIN_BASE_URL;
}

function normalizeQrStatus(status: string | undefined): "pending" | "scanned" | "authorized" | "expired" {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (normalized === "scaned" || normalized === "scanned") {
    return "scanned";
  }
  if (normalized === "confirmed" || normalized === "authorized" || normalized === "success") {
    return "authorized";
  }
  if (normalized === "expired" || normalized === "timeout") {
    return "expired";
  }
  return "pending";
}

function hasAuthorizedCredentials(status: WeixinQrStatusResponse): boolean {
  return Boolean(status.bot_token?.trim() && status.ilink_bot_id?.trim());
}

export class WeixinLoginService {
  private readonly api: WeixinApiClient;
  private readonly store: WeixinAccountStore;
  private readonly sessions = new Map<string, WeixinLoginSession>();

  constructor(deps: WeixinLoginServiceDeps = {}) {
    this.api = deps.api ?? new HttpWeixinApiClient();
    this.store = deps.store ?? new FileWeixinAccountStore();
  }

  readonly start = async (params: WeixinLoginParams): Promise<WeixinAuthStartResult> => {
    this.cleanupExpiredSessions();
    const currentConfig = normalizeWeixinChannelConfig(params.pluginConfig);
    const baseUrl = resolveLoginBaseUrl(params, currentConfig);
    const qrCode = await this.api.fetchQrCode({ baseUrl });
    const qrCodeUrl = qrCode.qrcode_img_content?.trim();
    const qrCodeValue = qrCode.qrcode?.trim();

    if (!qrCodeUrl || !qrCodeValue) {
      throw new Error("weixin login failed: QR code is unavailable");
    }

    const sessionId = randomUUID();
    const expiresAtMs = Date.now() + WEIXIN_LOGIN_TIMEOUT_MS;
    this.sessions.set(sessionId, {
      currentConfig,
      requestedAccountId: params.requestedAccountId,
      baseUrl,
      qrCode: qrCodeValue,
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
      note: "请使用微信扫码，并在手机上确认登录。",
    };
  };

  readonly poll = async ({ sessionId }: { sessionId: string }): Promise<WeixinAuthPollResult | null> => {
    this.cleanupExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    if (session.expiresAtMs <= Date.now()) {
      this.sessions.delete(sessionId);
      return {
        channel: WEIXIN_CHANNEL_ID,
        status: "expired",
        message: "二维码已过期，请重新扫码。",
      };
    }

    try {
      const status = await this.api.fetchQrStatus({
        baseUrl: session.baseUrl,
        qrcode: session.qrCode,
        timeoutMs: WEIXIN_AUTH_STATUS_TIMEOUT_MS,
      });
      const normalizedStatus = hasAuthorizedCredentials(status)
        ? "authorized"
        : normalizeQrStatus(status.status);

      if (normalizedStatus === "scanned") {
        return {
          channel: WEIXIN_CHANNEL_ID,
          status: "scanned",
          message: "二维码已扫码，请在微信中确认登录。",
          nextPollMs: WEIXIN_AUTH_POLL_INTERVAL_MS,
        };
      }

      if (normalizedStatus === "authorized") {
        const result = this.confirmLogin(session, status);
        this.sessions.delete(sessionId);
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

      if (normalizedStatus === "expired") {
        this.sessions.delete(sessionId);
        return {
          channel: WEIXIN_CHANNEL_ID,
          status: "expired",
          message: "二维码已过期，请重新扫码。",
        };
      }

      return {
        channel: WEIXIN_CHANNEL_ID,
        status: "pending",
        nextPollMs: WEIXIN_AUTH_POLL_INTERVAL_MS,
      };
    } catch (error) {
      return {
        channel: WEIXIN_CHANNEL_ID,
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };

  readonly login = async (
    params: WeixinLoginParams,
  ): Promise<{ pluginConfig: Record<string, unknown>; accountId?: string | null; notes?: string[] }> => {
    const started = await this.start(params);
    console.log("使用微信扫描以下二维码链接完成连接：");
    console.log(started.qrCodeUrl);
    console.log("");
    console.log("等待扫码确认...");

    let seenScanned = false;
    while (Date.now() < new Date(started.expiresAt).getTime()) {
      const status = await this.poll({ sessionId: started.sessionId });
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
  };

  private readonly confirmLogin = (
    session: WeixinLoginSession,
    status: WeixinQrStatusResponse,
  ): { pluginConfig: Record<string, unknown>; accountId: string; notes: string[] } => {
    const token = status.bot_token?.trim();
    const accountId = status.ilink_bot_id?.trim() || session.requestedAccountId?.trim();
    const baseUrl = status.baseurl?.trim() || session.baseUrl;
    const userId = status.ilink_user_id?.trim() || undefined;

    if (!token || !accountId) {
      throw new Error("weixin login failed: missing bot token or account id");
    }

    const replacementAccountIds = this.resolveReplacementAccountIds({
      currentConfig: session.currentConfig,
      requestedAccountId: session.requestedAccountId,
      accountId,
      userId,
    });
    for (const replacementAccountId of replacementAccountIds) {
      this.store.deleteAccount(replacementAccountId);
      this.store.deleteCursor(replacementAccountId);
    }

    this.store.saveAccount({
      accountId,
      token,
      baseUrl,
      userId,
      savedAt: new Date().toISOString(),
    });

    const notes = [
      ...(session.requestedAccountId?.trim() && session.requestedAccountId.trim() !== accountId
        ? [`Weixin account resolved to ${accountId}.`]
        : []),
      ...replacementAccountIds.map((replacementAccountId) => `Replaced previous Weixin account: ${replacementAccountId}`),
      ...(userId ? [`Authorized initial user: ${userId}`] : []),
    ];

    return {
      accountId,
      notes,
      pluginConfig: buildLoggedInWeixinChannelConfig({
        config: session.currentConfig,
        accountId,
        baseUrl,
        allowUserId: userId,
        replaceAccountIds: replacementAccountIds,
      }) as Record<string, unknown>,
    };
  };

  private readonly resolveReplacementAccountIds = (params: {
    currentConfig: WeixinChannelConfig;
    requestedAccountId?: string | null;
    accountId: string;
    userId?: string;
  }): string[] => {
    const { accountId, currentConfig, requestedAccountId: requestedAccountIdRaw, userId } = params;
    const replacementIds = new Set<string>();
    const requestedAccountId = requestedAccountIdRaw?.trim();
    const defaultAccountId = currentConfig.defaultAccountId?.trim();

    if (requestedAccountId && requestedAccountId !== accountId) {
      replacementIds.add(requestedAccountId);
    } else if (!requestedAccountId && defaultAccountId && defaultAccountId !== accountId) {
      replacementIds.add(defaultAccountId);
    }

    if (userId) {
      for (const [candidateAccountId, accountConfig] of Object.entries(currentConfig.accounts ?? {})) {
        if (candidateAccountId !== accountId && accountConfig.allowFrom?.includes(userId)) {
          replacementIds.add(candidateAccountId);
        }
      }
      for (const candidateAccountId of this.store.listAccountIds()) {
        if (candidateAccountId !== accountId && this.store.loadAccount(candidateAccountId)?.userId === userId) {
          replacementIds.add(candidateAccountId);
        }
      }
    }

    return [...replacementIds];
  };

  private readonly cleanupExpiredSessions = (now = Date.now()): void => {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAtMs <= now) {
        this.sessions.delete(sessionId);
      }
    }
  };
}
