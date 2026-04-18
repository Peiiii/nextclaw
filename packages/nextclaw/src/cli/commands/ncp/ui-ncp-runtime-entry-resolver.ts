import type { Config } from "@nextclaw/core";
import {
  normalizeUiNcpSessionTypeIcon,
  type UiNcpSessionTypeIcon,
  type UiNcpRuntimeEntry,
} from "./ui-ncp-runtime-registry.js";

const BUILTIN_RUNTIME_PRESENTATION = {
  claude: {
    label: "Claude",
    icon: {
      kind: "image",
      src: "app://runtime-icons/claude.ico",
      alt: "Claude",
    },
  },
  codex: {
    label: "Codex",
    icon: {
      kind: "image",
      src: "app://runtime-icons/codex-openai.svg",
      alt: "Codex",
    },
  },
  hermes: {
    label: "Hermes",
    icon: {
      kind: "image",
      src: "app://runtime-icons/hermes-agent.png",
      alt: "Hermes",
    },
  },
} satisfies Record<string, { label: string; icon?: UiNcpSessionTypeIcon }>;

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
): { label: string; icon?: UiNcpSessionTypeIcon } | null {
  const normalized = readString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }
  return BUILTIN_RUNTIME_PRESENTATION[normalized] ?? null;
}

function buildNativeRuntimeEntry(config: Config): UiNcpRuntimeEntry {
  const nativeRuntimeConfig = readRecord(config.ui?.ncp?.runtimes?.native) ?? {};
  return {
    id: "native",
    label: "Native",
    type: "native",
    enabled: nativeRuntimeConfig.enabled !== false,
    config: nativeRuntimeConfig,
  };
}

function buildBuiltinRuntimeEntry(kind: string, label: string): UiNcpRuntimeEntry {
  const presentation = resolveBuiltinRuntimePresentation(kind);
  return {
    id: kind,
    label: presentation?.label ?? label,
    ...(presentation?.icon ? { icon: presentation.icon } : {}),
    type: kind,
    enabled: true,
    config: {},
  };
}

export function resolveUiNcpRuntimeEntries(params: {
  config: Config;
  providerKinds: string[];
}): {
  defaultEntryId: string;
  entries: UiNcpRuntimeEntry[];
} {
  const providerKindSet = new Set(params.providerKinds.map((kind) => kind.trim().toLowerCase()).filter(Boolean));
  const entries = new Map<string, UiNcpRuntimeEntry>();

  entries.set("native", buildNativeRuntimeEntry(params.config));

  if (providerKindSet.has("codex")) {
    entries.set("codex", buildBuiltinRuntimeEntry("codex", "Codex"));
  }
  if (providerKindSet.has("claude")) {
    entries.set("claude", buildBuiltinRuntimeEntry("claude", "Claude"));
  }

  for (const [rawId, rawEntry] of Object.entries(params.config.agents.runtimes.entries ?? {})) {
    const id = rawId.trim().toLowerCase();
    const type = readString(rawEntry.type)?.toLowerCase();
    if (!id || !type) {
      continue;
    }
    const explicitIcon = normalizeUiNcpSessionTypeIcon(rawEntry.icon);
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
