import type { Config } from "@nextclaw/core";
import type { UiNcpRuntimeEntry } from "./ui-ncp-runtime-registry.js";

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
  return {
    id: kind,
    label,
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
    entries.set(id, {
      id,
      label: readString(rawEntry.label) ?? id,
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
