import type { FeishuAccountConfig, FeishuConfig } from "./config-schema.js";

export const DEFAULT_FEISHU_ACCOUNT_ID = "default";

export type FeishuBrand = "feishu" | "lark" | `https://${string}`;

export type FeishuResolvedAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;
  brand: FeishuBrand;
  config: FeishuAccountConfig;
  extra?: FeishuAccountConfig["extra"];
};

function normalizeAccountId(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_FEISHU_ACCOUNT_ID;
}

function resolveBrand(config: FeishuAccountConfig): FeishuBrand {
  if (config.extra?.domain) {
    return `https://open.${config.extra.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` as FeishuBrand;
  }
  return config.domain as FeishuBrand;
}

function stripAccounts(config: FeishuConfig): FeishuAccountConfig {
  const { accounts, ...rest } = config;
  void accounts;
  return rest;
}

export function getFeishuAccountIds(config: FeishuConfig): string[] {
  const accountIds = Object.keys(config.accounts ?? {});
  if (accountIds.length > 0) {
    return accountIds;
  }
  return [DEFAULT_FEISHU_ACCOUNT_ID];
}

export function getDefaultFeishuAccountId(config: FeishuConfig): string {
  return getFeishuAccountIds(config)[0] ?? DEFAULT_FEISHU_ACCOUNT_ID;
}

export function resolveFeishuAccount(config: FeishuConfig, accountId?: string | null): FeishuResolvedAccount {
  const resolvedAccountId = normalizeAccountId(accountId ?? getDefaultFeishuAccountId(config));
  const baseConfig = stripAccounts(config);
  const override = config.accounts?.[resolvedAccountId];
  const merged = override ? ({ ...baseConfig, ...override } satisfies FeishuAccountConfig) : baseConfig;
  const configured = Boolean(merged.appId && merged.appSecret);
  const enabled = Boolean(merged.enabled ?? configured);

  return {
    accountId: resolvedAccountId,
    enabled,
    configured,
    name: merged.name || undefined,
    appId: merged.appId || undefined,
    appSecret: merged.appSecret || undefined,
    encryptKey: merged.encryptKey || undefined,
    verificationToken: merged.verificationToken || undefined,
    brand: resolveBrand(merged),
    config: merged,
    extra: merged.extra
  };
}

export function getEnabledFeishuAccounts(config: FeishuConfig): FeishuResolvedAccount[] {
  return getFeishuAccountIds(config)
    .map((accountId) => resolveFeishuAccount(config, accountId))
    .filter((account) => account.enabled && account.configured);
}
