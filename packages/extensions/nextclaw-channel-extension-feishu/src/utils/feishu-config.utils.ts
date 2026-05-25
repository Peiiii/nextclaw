import type {
  FeishuAccountConfig,
  FeishuChannelConfig,
  FeishuDomain,
} from "../types/feishu-extension.types.js";

export const FEISHU_CHANNEL_ID = "feishu";
export const DEFAULT_FEISHU_DOMAIN: FeishuDomain = "feishu";

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

function readDomain(value: unknown): FeishuDomain | undefined {
  return value === "lark" || value === "feishu" ? value : undefined;
}

function readGroupPolicy(value: unknown): FeishuAccountConfig["groupPolicy"] {
  return value === "open" || value === "allowlist" || value === "disabled"
    ? value
    : undefined;
}

function normalizeAccountConfig(value: unknown): FeishuAccountConfig | undefined {
  const record = toRecord(value);
  if (!record) {
    return undefined;
  }
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    name: readString(record.name),
    domain: readDomain(record.domain),
    allowFrom: readStringArray(record.allowFrom),
    groupPolicy: readGroupPolicy(record.groupPolicy),
    requireMention: typeof record.requireMention === "boolean" ? record.requireMention : undefined,
  };
}

export function normalizeFeishuChannelConfig(value: unknown): FeishuChannelConfig {
  const record = toRecord(value);
  if (!record) {
    return {};
  }

  const accounts: Record<string, FeishuAccountConfig> = {};
  for (const [accountId, rawAccountConfig] of Object.entries(toRecord(record.accounts) ?? {})) {
    const normalized = normalizeAccountConfig(rawAccountConfig);
    if (normalized) {
      accounts[accountId] = normalized;
    }
  }

  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    defaultAccountId: readString(record.defaultAccountId),
    domain: readDomain(record.domain),
    allowFrom: readStringArray(record.allowFrom),
    groupPolicy: readGroupPolicy(record.groupPolicy),
    requireMention: typeof record.requireMention === "boolean" ? record.requireMention : undefined,
    accounts: Object.keys(accounts).length > 0 ? accounts : undefined,
  };
}

export function buildRegisteredFeishuChannelConfig({
  accountId,
  allowOpenId,
  botName,
  config,
  domain,
  replaceAccountIds,
}: {
  config: FeishuChannelConfig;
  accountId: string;
  domain: FeishuDomain;
  botName?: string;
  allowOpenId?: string;
  replaceAccountIds?: string[];
}): FeishuChannelConfig {
  const current = normalizeFeishuChannelConfig(config);
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
    ...(current.allowFrom ?? []),
    ...(currentAccount.allowFrom ?? []),
    ...(allowOpenId ? [allowOpenId] : []),
  ]);

  return {
    ...current,
    enabled: true,
    defaultAccountId: accountId,
    domain: current.domain ?? domain,
    accounts: {
      ...accounts,
      [accountId]: {
        ...currentAccount,
        enabled: true,
        domain,
        name: currentAccount.name ?? botName,
        allowFrom: allowFrom.size > 0 ? [...allowFrom] : undefined,
      },
    },
  };
}
