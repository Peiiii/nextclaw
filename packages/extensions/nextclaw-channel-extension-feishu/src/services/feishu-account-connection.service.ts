import {
  buildRegisteredFeishuChannelConfig,
  DEFAULT_FEISHU_DOMAIN,
  FEISHU_CHANNEL_ID,
  normalizeFeishuChannelConfig,
} from "../utils/feishu-config.utils.js";
import {
  FileFeishuAccountStore,
  type FeishuAccountStore,
} from "../stores/feishu-account.store.js";
import type { FeishuChannelConfig, FeishuDomain } from "../types/feishu-extension.types.js";

type FeishuAccountConnectionServiceDeps = {
  store?: FeishuAccountStore;
  fetchImpl?: typeof fetch;
};

export type FeishuAccountConnectionParams = {
  channelConfig?: Record<string, unknown>;
  requestedAccountId?: string | null;
  domain?: FeishuDomain | null;
  appId: string;
  appSecret: string;
  ownerOpenId?: string;
};

export type FeishuAccountConnectionResult = {
  channel: string;
  status: "authorized";
  message: string;
  accountId: string;
  notes: string[];
  channelConfig: Record<string, unknown>;
};

const FEISHU_OPEN_BASE_URLS: Record<FeishuDomain, string> = {
  feishu: "https://open.feishu.cn",
  lark: "https://open.larksuite.com",
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export class FeishuAccountConnectionService {
  private readonly store: FeishuAccountStore;
  private readonly fetchImpl: typeof fetch;

  constructor(deps: FeishuAccountConnectionServiceDeps = {}) {
    this.store = deps.store ?? new FileFeishuAccountStore();
    this.fetchImpl = deps.fetchImpl ?? fetch;
  }

  readonly connect = async (params: FeishuAccountConnectionParams): Promise<FeishuAccountConnectionResult> => {
    const { appId, appSecret, channelConfig, domain: requestedDomain, ownerOpenId, requestedAccountId } = params;
    const currentConfig = normalizeFeishuChannelConfig(channelConfig);
    const domain = requestedDomain ?? currentConfig.domain ?? DEFAULT_FEISHU_DOMAIN;
    const botInfo = await this.probeBot({
      appId,
      appSecret,
      domain,
    });
    const accountId = requestedAccountId?.trim() || appId;
    const replacementAccountIds = this.resolveReplacementAccountIds({
      accountId,
      botOpenId: botInfo.botOpenId,
      currentConfig,
      requestedAccountId,
    });
    for (const replacementAccountId of replacementAccountIds) {
      this.store.deleteAccount(replacementAccountId);
    }

    this.store.saveAccount({
      accountId,
      appId,
      appSecret,
      domain,
      botName: botInfo.botName,
      botOpenId: botInfo.botOpenId,
      ownerOpenId,
      savedAt: new Date().toISOString(),
    });

    const notes = [
      ...(botInfo.botName ? [`Connected bot: ${botInfo.botName}`] : []),
      ...replacementAccountIds.map((replacementAccountId) => `Replaced previous Feishu agent: ${replacementAccountId}`),
      ...(ownerOpenId ? [`Authorized initial user: ${ownerOpenId}`] : []),
    ];
    return {
      channel: FEISHU_CHANNEL_ID,
      status: "authorized",
      message: "飞书智能体已连接。",
      accountId,
      notes,
      channelConfig: buildRegisteredFeishuChannelConfig({
        config: currentConfig as FeishuChannelConfig,
        accountId,
        domain,
        botName: botInfo.botName,
        allowOpenId: ownerOpenId,
        replaceAccountIds: replacementAccountIds,
      }) as Record<string, unknown>,
    };
  };

  private readonly resolveReplacementAccountIds = (params: {
    accountId: string;
    botOpenId?: string;
    currentConfig: FeishuChannelConfig;
    requestedAccountId?: string | null;
  }): string[] => {
    const { accountId, botOpenId, currentConfig, requestedAccountId: requestedAccountIdRaw } = params;
    const replacementIds = new Set<string>();
    const defaultAccountId = currentConfig.defaultAccountId?.trim();
    const requestedAccountId = requestedAccountIdRaw?.trim();

    if (!requestedAccountId && defaultAccountId && defaultAccountId !== accountId) {
      replacementIds.add(defaultAccountId);
    }
    if (botOpenId) {
      for (const candidateAccountId of this.store.listAccountIds()) {
        if (candidateAccountId !== accountId && this.store.loadAccount(candidateAccountId)?.botOpenId === botOpenId) {
          replacementIds.add(candidateAccountId);
        }
      }
    }

    return [...replacementIds];
  };

  private readonly probeBot = async ({
    appId,
    appSecret,
    domain,
  }: {
    appId: string;
    appSecret: string;
    domain: FeishuDomain;
  }): Promise<{ botName?: string; botOpenId?: string }> => {
    const tokenResponse = await this.fetchImpl(`${FEISHU_OPEN_BASE_URLS[domain]}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const tokenData = await tokenResponse.json() as Record<string, unknown>;
    const accessToken = readString(tokenData.tenant_access_token);
    if (!tokenResponse.ok || !accessToken) {
      const message = readString(tokenData.msg) ?? readString(tokenData.error) ?? `HTTP ${tokenResponse.status}`;
      throw new Error(`Feishu credentials could not be verified: ${message}`);
    }
    const botResponse = await this.fetchImpl(`${FEISHU_OPEN_BASE_URLS[domain]}/open-apis/bot/v3/info`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const botData = await botResponse.json() as Record<string, unknown>;
    if (!botResponse.ok) {
      const message = readString(botData.msg) ?? readString(botData.error) ?? `HTTP ${botResponse.status}`;
      throw new Error(`Feishu bot info could not be loaded: ${message}`);
    }
    const bot = readRecord(botData.bot) ?? readRecord(readRecord(botData.data)?.bot);
    return {
      botName: readString(bot?.app_name) ?? readString(bot?.bot_name),
      botOpenId: readString(bot?.open_id),
    };
  };
}
