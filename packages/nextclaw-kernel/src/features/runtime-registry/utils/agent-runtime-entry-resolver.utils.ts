import type {
  AgentRuntimeSessionTypeIcon,
  AgentRuntimeEntry,
} from "@kernel/features/runtime-registry/services/agent-runtime-registry.service.js";

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

function normalizeAgentRuntimeSessionTypeIcon(
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
    id: "native",
    label: "Native",
    type: "native",
    enabled: nativeRuntimeConfig.enabled !== false,
    config: nativeRuntimeConfig,
  };
}

export function resolveAgentRuntimeEntries(params: {
  config: AgentRuntimeResolverConfig;
  providerKinds: string[];
}): {
  defaultEntryId: string;
  entries: AgentRuntimeEntry[];
} {
  const entries = new Map<string, AgentRuntimeEntry>();

  entries.set("native", buildNativeRuntimeEntry(params.config));

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

  const defaultEntryId = entries.has("native") ? "native" : [...entries.keys()][0] ?? "native";
  return {
    defaultEntryId,
    entries: [...entries.values()],
  };
}
