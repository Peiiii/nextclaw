import type { ClawdbotConfig, DmPolicy, GroupPolicy } from "./types.js";

export function mergeAllowFromEntries(
  current: Array<string | number> | null | undefined,
  additions: Array<string | number>,
): string[] {
  const merged = [...(current ?? []), ...additions].map((entry) => String(entry).trim()).filter(Boolean);
  return [...new Set(merged)];
}

export function splitOnboardingEntries(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function patchTopLevelChannelConfig(params: {
  cfg: ClawdbotConfig;
  channel: string;
  enabled?: boolean;
  patch: Record<string, unknown>;
}): ClawdbotConfig {
  const channelConfig =
    (params.cfg.channels?.[params.channel] as Record<string, unknown> | undefined) ?? {};
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      [params.channel]: {
        ...channelConfig,
        ...(params.enabled ? { enabled: true } : {}),
        ...params.patch,
      },
    },
  };
}

function addWildcardAllowFrom(allowFrom?: Array<string | number> | null): string[] {
  const next = (allowFrom ?? []).map((entry) => String(entry).trim()).filter(Boolean);
  if (!next.includes("*")) {
    next.push("*");
  }
  return next;
}

export function setTopLevelChannelAllowFrom(params: {
  cfg: ClawdbotConfig;
  channel: string;
  allowFrom: string[];
  enabled?: boolean;
}): ClawdbotConfig {
  return patchTopLevelChannelConfig({
    cfg: params.cfg,
    channel: params.channel,
    enabled: params.enabled,
    patch: { allowFrom: params.allowFrom },
  });
}

export function setTopLevelChannelDmPolicyWithAllowFrom(params: {
  cfg: ClawdbotConfig;
  channel: string;
  dmPolicy: DmPolicy;
  getAllowFrom?: (cfg: ClawdbotConfig) => Array<string | number> | undefined;
}): ClawdbotConfig {
  const channelConfig =
    (params.cfg.channels?.[params.channel] as Record<string, unknown> | undefined) ?? {};
  const existingAllowFrom =
    params.getAllowFrom?.(params.cfg) ??
    (channelConfig.allowFrom as Array<string | number> | undefined) ??
    undefined;
  const allowFrom = params.dmPolicy === "open" ? addWildcardAllowFrom(existingAllowFrom) : undefined;
  return patchTopLevelChannelConfig({
    cfg: params.cfg,
    channel: params.channel,
    patch: {
      dmPolicy: params.dmPolicy,
      ...(allowFrom ? { allowFrom } : {}),
    },
  });
}

export function setTopLevelChannelGroupPolicy(params: {
  cfg: ClawdbotConfig;
  channel: string;
  groupPolicy: GroupPolicy;
  enabled?: boolean;
}): ClawdbotConfig {
  return patchTopLevelChannelConfig({
    cfg: params.cfg,
    channel: params.channel,
    enabled: params.enabled,
    patch: { groupPolicy: params.groupPolicy },
  });
}

export function buildSingleChannelSecretPromptState(params: {
  accountConfigured: boolean;
  hasConfigToken: boolean;
  allowEnv: boolean;
  envValue?: string;
}) {
  return {
    accountConfigured: params.accountConfigured,
    hasConfigToken: params.hasConfigToken,
    canUseEnv: params.allowEnv && Boolean(params.envValue?.trim()) && !params.hasConfigToken,
  };
}
