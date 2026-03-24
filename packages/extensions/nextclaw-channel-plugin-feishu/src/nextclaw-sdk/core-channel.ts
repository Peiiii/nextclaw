import type { GroupPolicy, OpenClawConfig } from "./types.js";

export function emptyPluginConfigSchema(): {
  type: "object";
  additionalProperties: false;
  properties: Record<string, unknown>;
} {
  return {
    type: "object",
    additionalProperties: false,
    properties: {},
  };
}

const warnedMissingProviderGroupPolicy = new Set<string>();

export function resolveDefaultGroupPolicy(cfg: {
  channels?: {
    defaults?: {
      groupPolicy?: GroupPolicy;
    };
  };
}): GroupPolicy | undefined {
  return cfg.channels?.defaults?.groupPolicy;
}

export function resolveOpenProviderRuntimeGroupPolicy(params: {
  providerConfigPresent: boolean;
  groupPolicy?: GroupPolicy;
  defaultGroupPolicy?: GroupPolicy;
}): {
  groupPolicy: GroupPolicy;
  providerMissingFallbackApplied: boolean;
} {
  const groupPolicy = params.providerConfigPresent
    ? (params.groupPolicy ?? params.defaultGroupPolicy ?? "open")
    : (params.groupPolicy ?? "allowlist");
  return {
    groupPolicy,
    providerMissingFallbackApplied: !params.providerConfigPresent && params.groupPolicy === undefined,
  };
}

export function warnMissingProviderGroupPolicyFallbackOnce(params: {
  providerMissingFallbackApplied: boolean;
  providerKey: string;
  accountId?: string;
  blockedLabel?: string;
  log: (message: string) => void;
}): boolean {
  if (!params.providerMissingFallbackApplied) {
    return false;
  }
  const key = `${params.providerKey}:${params.accountId ?? "*"}`;
  if (warnedMissingProviderGroupPolicy.has(key)) {
    return false;
  }
  warnedMissingProviderGroupPolicy.add(key);
  const blockedLabel = params.blockedLabel?.trim() || "group messages";
  params.log(
    `${params.providerKey}: channels.${params.providerKey} is missing; defaulting groupPolicy to "allowlist" (${blockedLabel} blocked until explicitly configured).`,
  );
  return true;
}

export function evaluateSenderGroupAccessForPolicy(params: {
  groupPolicy: GroupPolicy;
  providerMissingFallbackApplied?: boolean;
  groupAllowFrom: string[];
  senderId: string;
  isSenderAllowed: (senderId: string, allowFrom: string[]) => boolean;
}): {
  allowed: boolean;
  groupPolicy: GroupPolicy;
  providerMissingFallbackApplied: boolean;
  reason: "allowed" | "disabled" | "empty_allowlist" | "sender_not_allowlisted";
} {
  if (params.groupPolicy === "disabled") {
    return {
      allowed: false,
      groupPolicy: params.groupPolicy,
      providerMissingFallbackApplied: Boolean(params.providerMissingFallbackApplied),
      reason: "disabled",
    };
  }
  if (params.groupPolicy === "allowlist") {
    if (params.groupAllowFrom.length === 0) {
      return {
        allowed: false,
        groupPolicy: params.groupPolicy,
        providerMissingFallbackApplied: Boolean(params.providerMissingFallbackApplied),
        reason: "empty_allowlist",
      };
    }
    if (!params.isSenderAllowed(params.senderId, params.groupAllowFrom)) {
      return {
        allowed: false,
        groupPolicy: params.groupPolicy,
        providerMissingFallbackApplied: Boolean(params.providerMissingFallbackApplied),
        reason: "sender_not_allowlisted",
      };
    }
  }
  return {
    allowed: true,
    groupPolicy: params.groupPolicy,
    providerMissingFallbackApplied: Boolean(params.providerMissingFallbackApplied),
    reason: "allowed",
  };
}

export function createDefaultChannelRuntimeState<T extends Record<string, unknown>>(
  accountId: string,
  extra?: T,
): {
  accountId: string;
  running: false;
  lastStartAt: null;
  lastStopAt: null;
  lastError: null;
} & T {
  return {
    accountId,
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null,
    ...(extra ?? ({} as T)),
  };
}

export function buildProbeChannelStatusSummary<TExtra extends Record<string, unknown>>(
  snapshot: {
    configured?: boolean | null;
    running?: boolean | null;
    lastStartAt?: number | null;
    lastStopAt?: number | null;
    lastError?: string | null;
    probe?: unknown;
    lastProbeAt?: number | null;
  },
  extra?: TExtra,
) {
  return {
    configured: snapshot.configured ?? false,
    running: snapshot.running ?? false,
    lastStartAt: snapshot.lastStartAt ?? null,
    lastStopAt: snapshot.lastStopAt ?? null,
    lastError: snapshot.lastError ?? null,
    ...(extra ?? ({} as TExtra)),
    probe: snapshot.probe,
    lastProbeAt: snapshot.lastProbeAt ?? null,
  };
}

export function buildRuntimeAccountStatusSnapshot(params: {
  runtime?: {
    running?: boolean | null;
    lastStartAt?: number | null;
    lastStopAt?: number | null;
    lastError?: string | null;
  } | null;
  probe?: unknown;
}) {
  return {
    running: params.runtime?.running ?? false,
    lastStartAt: params.runtime?.lastStartAt ?? null,
    lastStopAt: params.runtime?.lastStopAt ?? null,
    lastError: params.runtime?.lastError ?? null,
    probe: params.probe,
  };
}

export function mapAllowFromEntries(
  allowFrom: Array<string | number> | null | undefined,
): string[] {
  return (allowFrom ?? []).map((entry) => String(entry));
}

export function formatAllowFromLowercase(params: {
  allowFrom: Array<string | number>;
  stripPrefixRe?: RegExp;
}): string[] {
  return params.allowFrom
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .map((entry) => (params.stripPrefixRe ? entry.replace(params.stripPrefixRe, "") : entry))
    .map((entry) => entry.toLowerCase());
}

function applyDirectoryQueryAndLimit(
  ids: string[],
  params: { query?: string | null; limit?: number | null },
): string[] {
  const query = params.query?.trim().toLowerCase() || "";
  const limit = typeof params.limit === "number" && params.limit > 0 ? params.limit : undefined;
  const filtered = ids.filter((id) => (query ? id.toLowerCase().includes(query) : true));
  return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
}

function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function collectEntryIds(params: {
  entries?: readonly unknown[];
  normalizeId?: (entry: string) => string | null | undefined;
}): string[] {
  return (params.entries ?? [])
    .map((entry) => String(entry).trim())
    .filter((entry) => Boolean(entry) && entry !== "*")
    .map((entry) => {
      const normalized = params.normalizeId ? params.normalizeId(entry) : entry;
      return typeof normalized === "string" ? normalized.trim() : "";
    })
    .filter(Boolean);
}

function collectMapIds(params: {
  map?: Record<string, unknown>;
  normalizeId?: (entry: string) => string | null | undefined;
}): string[] {
  return collectEntryIds({
    entries: Object.keys(params.map ?? {}),
    normalizeId: params.normalizeId,
  });
}

export function listDirectoryUserEntriesFromAllowFromAndMapKeys(params: {
  allowFrom?: readonly unknown[];
  map?: Record<string, unknown>;
  query?: string | null;
  limit?: number | null;
  normalizeAllowFromId?: (entry: string) => string | null | undefined;
  normalizeMapKeyId?: (entry: string) => string | null | undefined;
}): Array<{ kind: "user"; id: string }> {
  const ids = dedupeIds([
    ...collectEntryIds({
      entries: params.allowFrom,
      normalizeId: params.normalizeAllowFromId,
    }),
    ...collectMapIds({
      map: params.map,
      normalizeId: params.normalizeMapKeyId,
    }),
  ]);
  return applyDirectoryQueryAndLimit(ids, params).map((id) => ({ kind: "user", id }));
}

export function listDirectoryGroupEntriesFromMapKeysAndAllowFrom(params: {
  groups?: Record<string, unknown>;
  allowFrom?: readonly unknown[];
  query?: string | null;
  limit?: number | null;
  normalizeMapKeyId?: (entry: string) => string | null | undefined;
  normalizeAllowFromId?: (entry: string) => string | null | undefined;
}): Array<{ kind: "group"; id: string }> {
  const ids = dedupeIds([
    ...collectMapIds({
      map: params.groups,
      normalizeId: params.normalizeMapKeyId,
    }),
    ...collectEntryIds({
      entries: params.allowFrom,
      normalizeId: params.normalizeAllowFromId,
    }),
  ]);
  return applyDirectoryQueryAndLimit(ids, params).map((id) => ({ kind: "group", id }));
}

export function collectAllowlistProviderRestrictSendersWarnings(params: {
  cfg: OpenClawConfig;
  providerConfigPresent: boolean;
  configuredGroupPolicy?: GroupPolicy | null;
  surface: string;
  openScope: string;
  groupPolicyPath: string;
  groupAllowFromPath: string;
  mentionGated?: boolean;
}): string[] {
  const defaultGroupPolicy = resolveDefaultGroupPolicy(params.cfg as {
    channels?: { defaults?: { groupPolicy?: GroupPolicy } };
  });
  const { groupPolicy } = resolveOpenProviderRuntimeGroupPolicy({
    providerConfigPresent: params.providerConfigPresent,
    groupPolicy: params.configuredGroupPolicy ?? undefined,
    defaultGroupPolicy,
  });
  if (groupPolicy !== "open") {
    return [];
  }
  const mentionSuffix = params.mentionGated === false ? "" : " (mention-gated)";
  return [
    `- ${params.surface}: groupPolicy="open" allows ${params.openScope} to trigger${mentionSuffix}. Set ${params.groupPolicyPath}="allowlist" + ${params.groupAllowFromPath} to restrict senders.`,
  ];
}
