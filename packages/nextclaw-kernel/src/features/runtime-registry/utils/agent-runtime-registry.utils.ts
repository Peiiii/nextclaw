import type { RuntimeModelSelectionMode } from "@nextclaw/shared";
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
  modelSelectionMode?: RuntimeModelSelectionMode;
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

type AgentRuntimeSessionTypeDescriptor = Omit<
  AgentRuntimeSessionTypeOption,
  "value" | "label"
>;

export type AgentRuntimeSessionTypeProvider = {
  describeSessionType?: (
    params?: AgentRuntimeSessionTypeDescribeParams,
  ) =>
    | Promise<AgentRuntimeSessionTypeDescriptor | null | undefined>
    | AgentRuntimeSessionTypeDescriptor
    | null
    | undefined;
  describeSessionTypeForEntry?: (params: {
    entry: AgentRuntimeEntry;
    describeParams?: AgentRuntimeSessionTypeDescribeParams;
  }) =>
    | Promise<AgentRuntimeSessionTypeDescriptor | null | undefined>
    | AgentRuntimeSessionTypeDescriptor
    | null
    | undefined;
};

export type AgentRuntimeProviderRegistration =
  AgentRuntimeSessionTypeProvider & {
    kind: string;
    label: string;
    createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
    createRuntimeForEntry?: (params: {
      entry: AgentRuntimeEntry;
      runtimeParams: RuntimeFactoryParams;
    }) => NcpAgentRuntime;
  };

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
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
} satisfies Record<
  string,
  { label: string; icon?: AgentRuntimeSessionTypeIcon }
>;

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
  return (
    BUILTIN_RUNTIME_PRESENTATION[normalized as BuiltinRuntimePresentationKey] ??
    null
  );
}

function buildNativeRuntimeEntry(
  config: AgentRuntimeResolverConfig,
): AgentRuntimeEntry {
  const nativeRuntimeConfig =
    readRecord(config.ui?.ncp?.runtimes?.native) ?? {};
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

  entries.set(
    DEFAULT_AGENT_RUNTIME_ENTRY_ID,
    buildNativeRuntimeEntry(params.config),
  );

  for (const [rawId, rawEntry] of Object.entries(
    params.config.agents.runtimes.entries ?? {},
  )) {
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
      ...((explicitIcon ?? builtinPresentation?.icon)
        ? { icon: explicitIcon ?? builtinPresentation?.icon }
        : {}),
      type,
      enabled: rawEntry.enabled !== false,
      config: rawEntry.config ? { ...rawEntry.config } : {},
    });
  }

  const defaultEntryId = entries.has(DEFAULT_AGENT_RUNTIME_ENTRY_ID)
    ? DEFAULT_AGENT_RUNTIME_ENTRY_ID
    : ([...entries.keys()][0] ?? DEFAULT_AGENT_RUNTIME_ENTRY_ID);
  return {
    defaultEntryId,
    entries: [...entries.values()],
  };
}

export async function describeAgentRuntimeSessionTypes(params: {
  entries: readonly AgentRuntimeEntry[];
  providers: ReadonlyMap<string, AgentRuntimeSessionTypeProvider>;
  defaultEntryId?: string;
  describeParams?: AgentRuntimeSessionTypeDescribeParams;
}): Promise<{
  defaultType: string;
  options: AgentRuntimeSessionTypeOption[];
}> {
  const entries = params.entries.filter((entry) => entry.enabled !== false);
  const defaultEntryId =
    normalizeIdentifier(params.defaultEntryId) ??
    (entries.some((entry) => entry.id === DEFAULT_AGENT_RUNTIME_ENTRY_ID)
      ? DEFAULT_AGENT_RUNTIME_ENTRY_ID
      : (entries[0]?.id ?? DEFAULT_AGENT_RUNTIME_ENTRY_ID));
  const options = await Promise.all(
    entries.map(async (entry) => {
      const provider = params.providers.get(entry.type);
      if (!provider) {
        return {
          value: entry.id,
          label: entry.label,
          icon: entry.icon ?? null,
          ready: false,
          reason: "runtime_provider_unavailable",
          reasonMessage: `Runtime provider unavailable for type "${entry.type}".`,
          recommendedModel: null,
          modelSelectionMode: "nextclaw",
          cta: {
            kind: "settings",
            label: "Configure Runtime",
          },
        } satisfies AgentRuntimeSessionTypeOption;
      }

      const descriptor = provider.describeSessionTypeForEntry
        ? await provider.describeSessionTypeForEntry({
            entry,
            describeParams: params.describeParams,
          })
        : await provider.describeSessionType?.(params.describeParams);
      return {
        value: entry.id,
        label: entry.label,
        icon: descriptor?.icon ?? entry.icon ?? null,
        ready: descriptor?.ready ?? true,
        reason: descriptor?.reason ?? null,
        reasonMessage: descriptor?.reasonMessage ?? null,
        recommendedModel: descriptor?.recommendedModel ?? null,
        modelSelectionMode: descriptor?.modelSelectionMode ?? "nextclaw",
        cta: descriptor?.cta ?? null,
        ...(descriptor?.supportedModels
          ? { supportedModels: descriptor.supportedModels }
          : {}),
      } satisfies AgentRuntimeSessionTypeOption;
    }),
  );

  return {
    defaultType: defaultEntryId,
    options,
  };
}
