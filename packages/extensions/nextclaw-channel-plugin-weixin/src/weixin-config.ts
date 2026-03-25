import type { Config } from "@nextclaw/core";

export const WEIXIN_PLUGIN_ID = "nextclaw-channel-weixin";
export const WEIXIN_CHANNEL_ID = "weixin";
export const DEFAULT_WEIXIN_BASE_URL = "https://ilinkai.weixin.qq.com";
export const DEFAULT_WEIXIN_BOT_TYPE = "3";
export const DEFAULT_WEIXIN_POLL_TIMEOUT_MS = 35_000;

export type WeixinAccountConfig = {
  enabled?: boolean;
  baseUrl?: string;
  allowFrom?: string[];
};

export type WeixinPluginConfig = {
  enabled?: boolean;
  defaultAccountId?: string;
  baseUrl?: string;
  pollTimeoutMs?: number;
  allowFrom?: string[];
  accounts?: Record<string, WeixinAccountConfig>;
};

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
  const items = value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return items.length > 0 ? items : undefined;
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

export function normalizeWeixinPluginConfig(value: unknown): WeixinPluginConfig {
  const record = toRecord(value);
  if (!record) {
    return {};
  }

  const accountsRecord = toRecord(record.accounts);
  const accounts: Record<string, WeixinAccountConfig> = {};
  for (const [accountId, rawAccountConfig] of Object.entries(accountsRecord ?? {})) {
    const normalized = normalizeAccountConfig(rawAccountConfig);
    if (!normalized) {
      continue;
    }
    accounts[accountId] = normalized;
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

export function readWeixinPluginConfigFromConfig(config: Config, _pluginId = WEIXIN_PLUGIN_ID): WeixinPluginConfig {
  const channelConfig = config.channels?.[WEIXIN_CHANNEL_ID];
  return normalizeWeixinPluginConfig(channelConfig);
}

export function isWeixinPluginEnabled(config: Config, pluginId = WEIXIN_PLUGIN_ID): boolean {
  const pluginEntry = config.plugins.entries?.[pluginId];
  if (pluginEntry?.enabled === false) {
    return false;
  }
  return readWeixinPluginConfigFromConfig(config, pluginId).enabled !== false;
}

export function resolveConfiguredWeixinAccountIds(pluginConfig: WeixinPluginConfig): string[] {
  const ids = new Set<string>();
  if (pluginConfig.defaultAccountId) {
    ids.add(pluginConfig.defaultAccountId);
  }
  for (const accountId of Object.keys(pluginConfig.accounts ?? {})) {
    ids.add(accountId);
  }
  return [...ids];
}

export function resolveWeixinAccountSelection(
  pluginConfig: WeixinPluginConfig,
  availableAccountIds: string[],
  requestedAccountId?: string | null,
): string | undefined {
  const candidate = readString(requestedAccountId);
  if (candidate) {
    return candidate;
  }
  if (pluginConfig.defaultAccountId) {
    return pluginConfig.defaultAccountId;
  }
  if (availableAccountIds.length === 1) {
    return availableAccountIds[0];
  }
  return undefined;
}

export function buildLoggedInWeixinPluginConfig(params: {
  pluginConfig: WeixinPluginConfig;
  accountId: string;
  baseUrl: string;
  allowUserId?: string;
  replaceAccountIds?: string[];
}): WeixinPluginConfig {
  const next = normalizeWeixinPluginConfig(params.pluginConfig);
  const replacementIds = new Set(
    (params.replaceAccountIds ?? [])
      .map((accountId) => readString(accountId))
      .filter((accountId): accountId is string => Boolean(accountId) && accountId !== params.accountId),
  );
  const accounts = Object.fromEntries(
    Object.entries(next.accounts ?? {}).filter(([accountId]) => !replacementIds.has(accountId)),
  );
  const currentAccount = next.accounts?.[params.accountId] ?? {};
  const allowFrom = new Set<string>([
    ...(currentAccount.allowFrom ?? []),
    ...(params.allowUserId ? [params.allowUserId] : []),
  ]);

  return {
    ...next,
    enabled: true,
    defaultAccountId: params.accountId,
    baseUrl: next.baseUrl ?? params.baseUrl,
    accounts: {
      ...accounts,
      [params.accountId]: {
        ...currentAccount,
        enabled: true,
        baseUrl: params.baseUrl,
        allowFrom: allowFrom.size > 0 ? [...allowFrom] : undefined,
      },
    },
  };
}

export const WEIXIN_PLUGIN_CONFIG_SCHEMA = {
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

export const WEIXIN_PLUGIN_CONFIG_UI_HINTS = {
  enabled: { label: "Enabled" },
  defaultAccountId: { label: "Default Account ID" },
  baseUrl: { label: "API Base URL" },
  pollTimeoutMs: { label: "Long Poll Timeout (ms)", advanced: true },
  allowFrom: { label: "Allow From" },
} as const;
