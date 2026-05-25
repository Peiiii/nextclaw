import { randomUUID } from "node:crypto";
import {
  DEFAULT_FEISHU_DOMAIN,
  FEISHU_CHANNEL_ID,
  normalizeFeishuChannelConfig,
} from "../utils/feishu-config.utils.js";
import {
  FileFeishuAccountStore,
  type FeishuAccountStore,
} from "../stores/feishu-account.store.js";
import { FeishuAccountConnectionService } from "./feishu-account-connection.service.js";
import type { FeishuChannelConfig, FeishuDomain } from "../types/feishu-extension.types.js";

export type FeishuRegistrationStartParams = {
  channelConfig?: Record<string, unknown>;
  requestedAccountId?: string | null;
  domain?: FeishuDomain | null;
  verbose?: boolean;
};

export type FeishuAuthStartResult = {
  channel: string;
  kind: "qr_code";
  sessionId: string;
  qrCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  intervalMs: number;
  note?: string;
};

export type FeishuAuthPollResult = {
  channel: string;
  status: "pending" | "scanned" | "authorized" | "expired" | "error";
  message?: string;
  nextPollMs?: number;
  accountId?: string | null;
  notes?: string[];
  channelConfig?: Record<string, unknown>;
};

type FeishuRegistrationSession = {
  currentConfig: FeishuChannelConfig;
  requestedAccountId?: string | null;
  deviceCode: string;
  domain: FeishuDomain;
  intervalMs: number;
  expiresAtMs: number;
};

type FeishuRegistrationResponse = Record<string, unknown>;

type FeishuRegistrationServiceDeps = {
  store?: FeishuAccountStore;
  fetchImpl?: typeof fetch;
  accountConnection?: Pick<FeishuAccountConnectionService, "connect">;
};

const REGISTRATION_PATH = "/oauth/v1/app/registration";
const FEISHU_ACCOUNTS_BASE_URLS: Record<FeishuDomain, string> = {
  feishu: "https://accounts.feishu.cn",
  lark: "https://accounts.larksuite.com",
};
const FEISHU_AUTH_POLL_INTERVAL_MS = 5_000;
const FEISHU_REGISTRATION_TIMEOUT_MS = 10 * 60_000;

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDomain(value: unknown): FeishuDomain | undefined {
  return value === "feishu" || value === "lark" ? value : undefined;
}

function appendHermesQrHints(url: string): string {
  if (!url.trim()) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}from=nextclaw&tp=nextclaw`;
}

export class FeishuRegistrationService {
  private readonly store: FeishuAccountStore;
  private readonly accountConnection: Pick<FeishuAccountConnectionService, "connect">;
  private readonly fetchImpl: typeof fetch;
  private readonly sessions = new Map<string, FeishuRegistrationSession>();

  constructor(deps: FeishuRegistrationServiceDeps = {}) {
    this.store = deps.store ?? new FileFeishuAccountStore();
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.accountConnection = deps.accountConnection ?? new FeishuAccountConnectionService({
      store: this.store,
      fetchImpl: this.fetchImpl,
    });
  }

  readonly start = async (
    params: FeishuRegistrationStartParams,
  ): Promise<FeishuAuthStartResult> => {
    this.cleanupExpiredSessions();
    const currentConfig = normalizeFeishuChannelConfig(params.channelConfig);
    const domain = params.domain ?? currentConfig.domain ?? DEFAULT_FEISHU_DOMAIN;
    await this.assertRegistrationSupported(domain);
    const begin = await this.beginRegistration(domain);
    const sessionId = randomUUID();
    const expiresAtMs = Date.now() + Math.min(begin.expiresInMs, FEISHU_REGISTRATION_TIMEOUT_MS);
    this.sessions.set(sessionId, {
      currentConfig,
      requestedAccountId: params.requestedAccountId,
      deviceCode: begin.deviceCode,
      domain,
      intervalMs: begin.intervalMs,
      expiresAtMs,
    });

    return {
      channel: FEISHU_CHANNEL_ID,
      kind: "qr_code",
      sessionId,
      qrCode: begin.qrUrl,
      qrCodeUrl: begin.qrUrl,
      expiresAt: new Date(expiresAtMs).toISOString(),
      intervalMs: begin.intervalMs,
      note: "请使用飞书或 Lark 扫码授权，NextClaw 会自动创建机器人应用并保存连接信息。",
    };
  };

  readonly poll = async ({ sessionId }: { sessionId: string }): Promise<FeishuAuthPollResult | null> => {
    this.cleanupExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    if (session.expiresAtMs <= Date.now()) {
      this.sessions.delete(sessionId);
      return {
        channel: FEISHU_CHANNEL_ID,
        status: "expired",
        message: "飞书扫码授权已过期，请重新开始。",
      };
    }

    try {
      const response = await this.postRegistration(session.domain, {
        action: "poll",
        device_code: session.deviceCode,
        tp: "ob_app",
      });
      const userInfo = this.readRecord(response.user_info) ?? {};
      const switchedDomain = readDomain(userInfo.tenant_brand) ?? session.domain;
      if (switchedDomain !== session.domain) {
        session.domain = switchedDomain;
      }
      const clientId = readString(response.client_id);
      const clientSecret = readString(response.client_secret);
      if (clientId && clientSecret) {
        const result = await this.confirmRegistration({
          session,
          appId: clientId,
          appSecret: clientSecret,
          ownerOpenId: readString(userInfo.open_id),
        });
        this.sessions.delete(sessionId);
        return {
          channel: FEISHU_CHANNEL_ID,
          status: "authorized",
          message: "飞书已连接。",
          nextPollMs: 0,
          accountId: result.accountId,
          notes: result.notes,
          channelConfig: result.channelConfig,
        };
      }

      const error = readString(response.error);
      if (error === "access_denied" || error === "expired_token") {
        this.sessions.delete(sessionId);
        return {
          channel: FEISHU_CHANNEL_ID,
          status: "expired",
          message: error === "access_denied" ? "飞书授权已取消。" : "飞书扫码授权已过期。",
        };
      }
      return {
        channel: FEISHU_CHANNEL_ID,
        status: "pending",
        nextPollMs: session.intervalMs,
      };
    } catch (error) {
      return {
        channel: FEISHU_CHANNEL_ID,
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };

  private readonly assertRegistrationSupported = async (domain: FeishuDomain): Promise<void> => {
    const response = await this.postRegistration(domain, { action: "init" });
    const methods = Array.isArray(response.supported_auth_methods)
      ? response.supported_auth_methods
      : [];
    if (!methods.includes("client_secret")) {
      throw new Error(`Feishu registration does not support client_secret auth. Supported: ${methods.join(", ")}`);
    }
  };

  private readonly beginRegistration = async (
    domain: FeishuDomain,
  ): Promise<{
    deviceCode: string;
    qrUrl: string;
    intervalMs: number;
    expiresInMs: number;
  }> => {
    const response = await this.postRegistration(domain, {
      action: "begin",
      archetype: "PersonalAgent",
      auth_method: "client_secret",
      request_user_info: "open_id",
    });
    const deviceCode = readString(response.device_code);
    const qrUrl = readString(response.verification_uri_complete);
    if (!deviceCode || !qrUrl) {
      throw new Error("Feishu registration did not return a device code and QR URL.");
    }
    return {
      deviceCode,
      qrUrl: appendHermesQrHints(qrUrl),
      intervalMs: Math.max(1, Number(response.interval ?? 5)) * 1000 || FEISHU_AUTH_POLL_INTERVAL_MS,
      expiresInMs: Math.max(60, Number(response.expire_in ?? 600)) * 1000,
    };
  };

  private readonly postRegistration = async (
    domain: FeishuDomain,
    body: Record<string, string>,
  ): Promise<FeishuRegistrationResponse> => {
    const response = await this.fetchImpl(`${FEISHU_ACCOUNTS_BASE_URLS[domain]}${REGISTRATION_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
    const data = await response.json() as FeishuRegistrationResponse;
    if (!response.ok && !data.error) {
      throw new Error(`Feishu registration failed: HTTP ${response.status}`);
    }
    return data;
  };

  private readonly confirmRegistration = async ({
    appId,
    appSecret,
    ownerOpenId,
    session,
  }: {
    session: FeishuRegistrationSession;
    appId: string;
    appSecret: string;
    ownerOpenId?: string;
  }): Promise<{ channelConfig: Record<string, unknown>; accountId: string; notes: string[] }> => {
    const result = await this.accountConnection.connect({
      channelConfig: session.currentConfig,
      requestedAccountId: session.requestedAccountId,
      appId,
      appSecret,
      domain: session.domain,
      ownerOpenId,
    });
    return {
      accountId: result.accountId,
      notes: result.notes,
      channelConfig: result.channelConfig,
    };
  };

  private readonly readRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  };

  private readonly cleanupExpiredSessions = (now = Date.now()): void => {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAtMs <= now) {
        this.sessions.delete(sessionId);
      }
    }
  };
}
