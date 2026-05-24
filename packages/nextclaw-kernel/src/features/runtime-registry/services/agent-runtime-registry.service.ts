import { toDisposable, type Disposable } from "@nextclaw/core";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import { DEFAULT_AGENT_RUNTIME_ENTRY_ID } from "@kernel/configs/agent-runtime.config.js";

export type AgentRuntimeSessionTypeIcon = {
  kind: "image";
  src: string;
  alt?: string | null;
};

export type AgentRuntimeSessionTypeOption = {
  value: string;
  label: string;
  icon?: AgentRuntimeSessionTypeIcon | null;
  ready?: boolean;
  reason?: string | null;
  reasonMessage?: string | null;
  supportedModels?: string[];
  recommendedModel?: string | null;
  cta?: {
    kind: string;
    label?: string;
    href?: string;
  } | null;
};

export type AgentRuntimeSessionTypeDescribeParams = {
  describeMode?: "observation" | "probe";
};

export type AgentRuntimeEntry = {
  id: string;
  label: string;
  icon?: AgentRuntimeSessionTypeIcon | null;
  type: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

export type AgentRuntimeProviderRegistration = {
  kind: string;
  label: string;
  createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
  createRuntimeForEntry?: (params: {
    entry: AgentRuntimeEntry;
    runtimeParams: RuntimeFactoryParams;
  }) => NcpAgentRuntime;
  describeSessionType?: (params?: AgentRuntimeSessionTypeDescribeParams) => Promise<Omit<AgentRuntimeSessionTypeOption, "value" | "label"> | null | undefined>
    | Omit<AgentRuntimeSessionTypeOption, "value" | "label">
    | null
    | undefined;
  describeSessionTypeForEntry?: (params: {
    entry: AgentRuntimeEntry;
    describeParams?: AgentRuntimeSessionTypeDescribeParams;
  }) => Promise<Omit<AgentRuntimeSessionTypeOption, "value" | "label"> | null | undefined>
    | Omit<AgentRuntimeSessionTypeOption, "value" | "label">
    | null
    | undefined;
};

type RuntimeProviderRegistrationEntry = AgentRuntimeProviderRegistration & { token: symbol };

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function cloneRuntimeEntry(entry: AgentRuntimeEntry): AgentRuntimeEntry {
  return {
    id: entry.id,
    label: entry.label,
    ...(entry.icon ? { icon: { ...entry.icon } } : {}),
    type: entry.type,
    enabled: entry.enabled !== false,
    config: entry.config ? { ...entry.config } : {},
  };
}

export function normalizeAgentRuntimeSessionTypeIcon(
  value: unknown,
): AgentRuntimeSessionTypeIcon | null {
  if (typeof value === "string") {
    const src = value.trim();
    return src ? { kind: "image", src } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const iconRecord = value as Record<string, unknown>;
  const src = typeof iconRecord.src === "string" ? iconRecord.src.trim() : "";
  if (!src) {
    return null;
  }
  const alt =
    typeof iconRecord.alt === "string" && iconRecord.alt.trim().length > 0
      ? iconRecord.alt.trim()
      : null;
  return {
    kind: "image",
    src,
    ...(alt ? { alt } : {}),
  };
}

type ConfigRuntimeEntry = {
  enabled?: boolean;
  label?: string;
  icon?: unknown;
  type?: string;
  config?: Record<string, unknown>;
};

type AgentRuntimeResolverConfig = {
  ui?: {
    ncp?: {
      runtimes?: {
        native?: unknown;
      };
    };
  };
  agents: {
    runtimes: {
      entries?: Record<string, ConfigRuntimeEntry>;
    };
  };
};

const BUILTIN_RUNTIME_PRESENTATION = {
  hermes: {
    label: "Hermes",
    icon: {
      kind: "image",
      src: "app://runtime-icons/hermes-agent.png",
      alt: "Hermes",
    },
  },
} satisfies Record<string, { label: string; icon?: AgentRuntimeSessionTypeIcon }>;

type BuiltinRuntimePresentationKey = keyof typeof BUILTIN_RUNTIME_PRESENTATION;

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function resolveBuiltinRuntimePresentation(
  value: string | undefined,
): { label: string; icon?: AgentRuntimeSessionTypeIcon } | null {
  const normalized = readString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (!(normalized in BUILTIN_RUNTIME_PRESENTATION)) {
    return null;
  }
  return BUILTIN_RUNTIME_PRESENTATION[normalized as BuiltinRuntimePresentationKey] ?? null;
}

function buildNativeRuntimeEntry(config: AgentRuntimeResolverConfig): AgentRuntimeEntry {
  const nativeRuntimeConfig = readRecord(config.ui?.ncp?.runtimes?.native) ?? {};
  return {
    id: DEFAULT_AGENT_RUNTIME_ENTRY_ID,
    label: "Native",
    type: DEFAULT_AGENT_RUNTIME_ENTRY_ID,
    enabled: nativeRuntimeConfig.enabled !== false,
    config: nativeRuntimeConfig,
  };
}

export function resolveAgentRuntimeEntries(params: {
  config: AgentRuntimeResolverConfig;
}): {
  defaultEntryId: string;
  entries: AgentRuntimeEntry[];
} {
  const entries = new Map<string, AgentRuntimeEntry>();

  entries.set(DEFAULT_AGENT_RUNTIME_ENTRY_ID, buildNativeRuntimeEntry(params.config));

  for (const [rawId, rawEntry] of Object.entries(params.config.agents.runtimes.entries ?? {})) {
    const id = rawId.trim().toLowerCase();
    const type = readString(rawEntry.type)?.toLowerCase();
    if (!id || !type) {
      continue;
    }
    const explicitIcon = normalizeAgentRuntimeSessionTypeIcon(rawEntry.icon);
    const builtinPresentation =
      resolveBuiltinRuntimePresentation(id) ??
      resolveBuiltinRuntimePresentation(type);
    entries.set(id, {
      id,
      label: readString(rawEntry.label) ?? builtinPresentation?.label ?? id,
      ...(explicitIcon ?? builtinPresentation?.icon
        ? { icon: explicitIcon ?? builtinPresentation?.icon }
        : {}),
      type,
      enabled: rawEntry.enabled !== false,
      config: rawEntry.config ? { ...rawEntry.config } : {},
    });
  }

  const defaultEntryId = entries.has(DEFAULT_AGENT_RUNTIME_ENTRY_ID)
    ? DEFAULT_AGENT_RUNTIME_ENTRY_ID
    : [...entries.keys()][0] ?? DEFAULT_AGENT_RUNTIME_ENTRY_ID;
  return {
    defaultEntryId,
    entries: [...entries.values()],
  };
}

function readRequestedRuntimeEntryId(sessionMetadata: Record<string, unknown>): string | null {
  return (
    normalizeIdentifier(sessionMetadata.runtime) ??
    normalizeIdentifier(sessionMetadata.session_type) ??
    normalizeIdentifier(sessionMetadata.sessionType) ??
    null
  );
}

export class AgentRuntimeRegistry {
  private readonly providers = new Map<string, RuntimeProviderRegistrationEntry>();
  private entries = new Map<string, AgentRuntimeEntry>();
  private defaultEntryId = DEFAULT_AGENT_RUNTIME_ENTRY_ID;

  register = (registration: AgentRuntimeProviderRegistration): Disposable => {
    const normalizedKind = normalizeIdentifier(registration.kind);
    if (!normalizedKind) {
      throw new Error("agent runtime kind must be a non-empty string");
    }

    const token = Symbol(normalizedKind);
    this.providers.set(normalizedKind, {
      ...registration,
      kind: normalizedKind,
      token,
    });

    return toDisposable(() => {
      const current = this.providers.get(normalizedKind);
      if (!current || current.token !== token) {
        return;
      }
      this.providers.delete(normalizedKind);
    });
  };

  applyEntries = (params: {
    entries: AgentRuntimeEntry[];
    defaultEntryId?: string;
  }): void => {
    const nextEntries = new Map<string, AgentRuntimeEntry>();
    for (const rawEntry of params.entries) {
      const id = normalizeIdentifier(rawEntry.id);
      const type = normalizeIdentifier(rawEntry.type);
      const label = rawEntry.label?.trim() ?? "";
      if (!id || !type || !label) {
        continue;
      }
      nextEntries.set(id, cloneRuntimeEntry({
        ...rawEntry,
        id,
        type,
        label,
      }));
    }
    this.entries = nextEntries;
    this.defaultEntryId =
      normalizeIdentifier(params.defaultEntryId) ??
      (nextEntries.has(DEFAULT_AGENT_RUNTIME_ENTRY_ID)
        ? DEFAULT_AGENT_RUNTIME_ENTRY_ID
        : [...nextEntries.keys()][0] ?? DEFAULT_AGENT_RUNTIME_ENTRY_ID);
  };

  resolveSessionMetadata = (sessionMetadata: Record<string, unknown>): Record<string, unknown> => {
    const { entry } = this.resolveRuntimeEntry(sessionMetadata);
    return {
      ...sessionMetadata,
      runtime: entry.id,
      session_type: entry.id,
      runtime_type: entry.type,
    };
  };

  createRuntime = (params: RuntimeFactoryParams): NcpAgentRuntime => {
    const nextSessionMetadata = this.resolveSessionMetadata(params.sessionMetadata);
    const { entry, provider } = this.resolveRuntimeEntry(nextSessionMetadata);
    if (provider.createRuntimeForEntry) {
      return provider.createRuntimeForEntry({
        entry: cloneRuntimeEntry(entry),
        runtimeParams: {
          ...params,
          sessionMetadata: nextSessionMetadata,
        },
      });
    }
    return provider.createRuntime({
      ...params,
      sessionMetadata: nextSessionMetadata,
    });
  };

  private resolveRuntimeEntry = (sessionMetadata: Record<string, unknown>) => {
    const requestedEntryId =
      readRequestedRuntimeEntryId(sessionMetadata) ?? this.defaultEntryId;
    const entry = this.entries.get(requestedEntryId);
    if (!entry || entry.enabled === false) {
      throw new Error(`ncp runtime unavailable: ${requestedEntryId}`);
    }

    const provider = this.providers.get(entry.type);
    if (!provider) {
      throw new Error(`ncp runtime provider unavailable: ${entry.type}`);
    }
    return { entry, provider };
  };

  listSessionTypes = async (params?: AgentRuntimeSessionTypeDescribeParams): Promise<{
    defaultType: string;
    options: AgentRuntimeSessionTypeOption[];
  }> => {
    const options = await Promise.all(
      [...this.entries.values()]
        .filter((entry) => entry.enabled !== false)
        .map(async (entry) => {
          const provider = this.providers.get(entry.type);
          if (!provider) {
            return {
              value: entry.id,
              label: entry.label,
              icon: entry.icon ?? null,
              ready: false,
              reason: "runtime_provider_unavailable",
              reasonMessage: `Runtime provider unavailable for type "${entry.type}".`,
              recommendedModel: null,
              cta: {
                kind: "settings",
                label: "Configure Runtime",
              },
            } satisfies AgentRuntimeSessionTypeOption;
          }

          const descriptor = provider.describeSessionTypeForEntry
            ? await provider.describeSessionTypeForEntry({
                entry: cloneRuntimeEntry(entry),
                describeParams: params,
              })
            : await provider.describeSessionType?.(params);
          return {
            value: entry.id,
            label: entry.label,
            icon: descriptor?.icon ?? entry.icon ?? null,
            ready: descriptor?.ready ?? true,
            reason: descriptor?.reason ?? null,
            reasonMessage: descriptor?.reasonMessage ?? null,
            recommendedModel: descriptor?.recommendedModel ?? null,
            cta: descriptor?.cta ?? null,
            ...(descriptor?.supportedModels ? { supportedModels: descriptor.supportedModels } : {}),
          } satisfies AgentRuntimeSessionTypeOption;
        }),
    );

    return {
      defaultType: this.defaultEntryId,
      options: options.sort((left, right) => {
        if (left.value === this.defaultEntryId) {
          return -1;
        }
        if (right.value === this.defaultEntryId) {
          return 1;
        }
        return left.value.localeCompare(right.value);
      }),
    };
  };
}
