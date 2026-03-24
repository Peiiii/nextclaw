import * as Lark from "@larksuiteoapi/node-sdk";
import type { FeishuBrand, FeishuResolvedAccount } from "./accounts.js";
import type { FeishuProbeResult } from "./probe.js";

type RequestClient = {
  request: (options: {
    method: string;
    url: string;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

type FeishuCredentials = {
  accountId?: string;
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;
  brand?: FeishuBrand;
  extra?: {
    httpHeaders?: Record<string, string>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveSdkDomain(brand: FeishuBrand): Lark.Domain | string {
  if (brand === "feishu") {
    return Lark.Domain.Feishu;
  }
  if (brand === "lark") {
    return Lark.Domain.Lark;
  }
  return brand.replace(/\/+$/, "");
}

function createHttpInstanceWithHeaders(headers: Record<string, string>) {
  const base = Lark.defaultHttpInstance;
  const wrapper = Object.create(base) as typeof base;
  wrapper.request = ((options) =>
    base.request({
      ...options,
      headers: {
        ...(options?.headers ?? {}),
        ...headers
      }
    })) as typeof base.request;
  return wrapper;
}

const CLIENT_CACHE = new Map<string, LarkClient>();

export class LarkClient {
  private sdkClient: Lark.Client | null = null;
  private wsClient: Lark.WSClient | null = null;

  constructor(public readonly account: FeishuResolvedAccount) {}

  static fromAccount(account: FeishuResolvedAccount): LarkClient {
    const cached = CLIENT_CACHE.get(account.accountId);
    if (cached && cached.account.appId === account.appId && cached.account.appSecret === account.appSecret) {
      return cached;
    }
    cached?.dispose();
    const client = new LarkClient(account);
    CLIENT_CACHE.set(account.accountId, client);
    return client;
  }

  static fromCredentials(credentials: FeishuCredentials): LarkClient {
    return new LarkClient({
      accountId: credentials.accountId ?? "default",
      enabled: true,
      configured: Boolean(credentials.appId && credentials.appSecret),
      appId: credentials.appId,
      appSecret: credentials.appSecret,
      encryptKey: credentials.encryptKey,
      verificationToken: credentials.verificationToken,
      brand: credentials.brand ?? "feishu",
      config: {
        enabled: true,
        name: "",
        appId: credentials.appId ?? "",
        appSecret: credentials.appSecret ?? "",
        encryptKey: credentials.encryptKey ?? "",
        verificationToken: credentials.verificationToken ?? "",
        domain: credentials.brand ?? "feishu",
        allowFrom: [],
        dmPolicy: "open",
        groupPolicy: "open",
        groupAllowFrom: [],
        requireMention: false,
        mentionPatterns: [],
        groups: {},
        textChunkLimit: 4000,
        mediaMaxMb: 20,
        threadSession: false,
        extra: credentials.extra ?? {}
      },
      extra: credentials.extra
    });
  }

  get sdk(): Lark.Client {
    if (!this.sdkClient) {
      if (!this.account.appId || !this.account.appSecret) {
        throw new Error(`Feishu account '${this.account.accountId}' is missing app credentials`);
      }
      const httpHeaders = this.account.extra?.httpHeaders;
      this.sdkClient = new Lark.Client({
        appId: this.account.appId,
        appSecret: this.account.appSecret,
        appType: Lark.AppType.SelfBuild,
        domain: resolveSdkDomain(this.account.brand),
        ...(httpHeaders && Object.keys(httpHeaders).length > 0
          ? { httpInstance: createHttpInstanceWithHeaders(httpHeaders) }
          : {})
      });
    }
    return this.sdkClient;
  }

  createEventDispatcher(handler: (payload: Record<string, unknown>) => Promise<void>): Lark.EventDispatcher {
    return new Lark.EventDispatcher({
      encryptKey: this.account.encryptKey || undefined,
      verificationToken: this.account.verificationToken || undefined
    }).register({
      "im.message.receive_v1": async (payload: Record<string, unknown>) => {
        await handler(payload);
      }
    });
  }

  startWebsocket(handler: (payload: Record<string, unknown>) => Promise<void>): void {
    this.closeWebsocket();
    this.wsClient = new Lark.WSClient({
      appId: this.requireCredential("appId"),
      appSecret: this.requireCredential("appSecret"),
      loggerLevel: Lark.LoggerLevel.info
    });
    this.wsClient.start({
      eventDispatcher: this.createEventDispatcher(handler)
    });
  }

  closeWebsocket(): void {
    this.wsClient?.close();
    this.wsClient = null;
  }

  async probe(): Promise<FeishuProbeResult> {
    if (!this.account.appId || !this.account.appSecret) {
      return { ok: false, error: "missing credentials (appId, appSecret)" };
    }
    try {
      const response = await (this.sdk as unknown as RequestClient).request({
        method: "GET",
        url: "/open-apis/bot/v3/info",
        data: {}
      });
      if (!isRecord(response)) {
        return { ok: false, appId: this.account.appId, error: "API error: invalid response" };
      }
      const code = typeof response.code === "number" ? response.code : null;
      if (code !== 0) {
        const msg = typeof response.msg === "string" ? response.msg : undefined;
        return {
          ok: false,
          appId: this.account.appId,
          error: `API error: ${msg || `code ${code ?? "unknown"}`}`
        };
      }
      const botFromResponse = isRecord(response.bot) ? response.bot : undefined;
      const data = isRecord(response.data) ? response.data : undefined;
      const botFromData = data && isRecord(data.bot) ? data.bot : undefined;
      const bot = botFromResponse ?? botFromData;
      return {
        ok: true,
        appId: this.account.appId,
        botName: bot && typeof bot.bot_name === "string" ? bot.bot_name : undefined,
        botOpenId: bot && typeof bot.open_id === "string" ? bot.open_id : undefined
      };
    } catch (error) {
      return {
        ok: false,
        appId: this.account.appId,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async sendInteractiveCard(params: {
    receiveId: string;
    receiveIdType: "chat_id" | "open_id" | "user_id" | "union_id";
    content: string;
  }): Promise<void> {
    await this.sdk.im.message.create({
      params: { receive_id_type: params.receiveIdType },
      data: {
        receive_id: params.receiveId,
        msg_type: "interactive",
        content: params.content
      }
    });
  }

  async addReaction(messageId: string, emojiType: string): Promise<void> {
    await this.sdk.im.messageReaction.create({
      path: { message_id: messageId },
      data: {
        reaction_type: { emoji_type: emojiType }
      }
    });
  }

  dispose(): void {
    this.closeWebsocket();
    this.sdkClient = null;
  }

  private requireCredential(key: "appId" | "appSecret"): string {
    const value = this.account[key];
    if (!value) {
      throw new Error(`Feishu account '${this.account.accountId}' is missing ${key}`);
    }
    return value;
  }
}
