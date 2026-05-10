import type { WeixinAccountConfig, WeixinChannelConfig } from "../weixin-extension.types.js";

export const WEIXIN_EXTENSION_ID = "nextclaw-channel-extension-weixin";
export const WEIXIN_CHANNEL_ID = "weixin";
export const DEFAULT_WEIXIN_BASE_URL = "https://ilinkai.weixin.qq.com";

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const values = value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return values.length > 0 ? values : undefined;
}

function normalizeAccountConfig(value: unknown): WeixinAccountConfig | undefined {
  const record = toRecord(value);
  if (!record) {
    return undefined;
  }
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    baseUrl: readString(record.baseUrl),
    allowFrom: readStringArray(record.allowFrom),
  };
}

export function normalizeWeixinChannelConfig(value: unknown): WeixinChannelConfig {
  const record = toRecord(value);
  if (!record) {
    return {};
  }

  const accounts: Record<string, WeixinAccountConfig> = {};
  for (const [accountId, rawAccountConfig] of Object.entries(toRecord(record.accounts) ?? {})) {
    const normalized = normalizeAccountConfig(rawAccountConfig);
    if (normalized) {
      accounts[accountId] = normalized;
    }
  }

  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    defaultAccountId: readString(record.defaultAccountId),
    baseUrl: readString(record.baseUrl),
    pollTimeoutMs:
      typeof record.pollTimeoutMs === "number" && Number.isFinite(record.pollTimeoutMs)
        ? Math.max(1_000, Math.trunc(record.pollTimeoutMs))
        : undefined,
    allowFrom: readStringArray(record.allowFrom),
    accounts: Object.keys(accounts).length > 0 ? accounts : undefined,
  };
}

export function buildLoggedInWeixinChannelConfig(params: {
  config: WeixinChannelConfig;
  accountId: string;
  baseUrl: string;
  allowUserId?: string;
  replaceAccountIds?: string[];
}): WeixinChannelConfig {
  const { accountId, allowUserId, baseUrl, config, replaceAccountIds } = params;
  const current = normalizeWeixinChannelConfig(config);
  const replacementIds = new Set(
    (replaceAccountIds ?? [])
      .map((accountId) => readString(accountId))
      .filter((replacementAccountId): replacementAccountId is string =>
        Boolean(replacementAccountId) && replacementAccountId !== accountId
      ),
  );
  const accounts = Object.fromEntries(
    Object.entries(current.accounts ?? {}).filter(([accountId]) => !replacementIds.has(accountId)),
  );
  const currentAccount = current.accounts?.[accountId] ?? {};
  const allowFrom = new Set([
    ...(currentAccount.allowFrom ?? []),
    ...(allowUserId ? [allowUserId] : []),
  ]);

  return {
    ...current,
    enabled: true,
    defaultAccountId: accountId,
    baseUrl: current.baseUrl ?? baseUrl,
    accounts: {
      ...accounts,
      [accountId]: {
        ...currentAccount,
        enabled: true,
        baseUrl,
        allowFrom: allowFrom.size > 0 ? [...allowFrom] : undefined,
      },
    },
  };
}

export const WEIXIN_CHANNEL_CONFIG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    enabled: { type: "boolean" },
    defaultAccountId: { type: "string" },
    baseUrl: { type: "string" },
    pollTimeoutMs: { type: "number" },
    allowFrom: {
      type: "array",
      items: { type: "string" },
    },
    accounts: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean" },
          baseUrl: { type: "string" },
          allowFrom: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
} as const;

export const WEIXIN_CHANNEL_CONFIG_UI_HINTS = {
  enabled: { label: "Enabled" },
  defaultAccountId: { label: "Default Account ID" },
  baseUrl: { label: "API Base URL" },
  pollTimeoutMs: { label: "Long Poll Timeout (ms)", advanced: true },
  allowFrom: { label: "Allow From" },
} as const;
