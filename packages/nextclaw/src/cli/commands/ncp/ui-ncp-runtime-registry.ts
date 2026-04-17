import { toDisposable, type Disposable } from "@nextclaw/core";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";

export const DEFAULT_UI_NCP_RUNTIME_ENTRY_ID = "native";

export type UiNcpSessionTypeOption = {
  value: string;
  label: string;
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

export type UiNcpSessionTypeDescribeParams = {
  describeMode?: "observation" | "probe";
};

export type UiNcpRuntimeEntry = {
  id: string;
  label: string;
  type: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

export type UiNcpRuntimeProviderRegistration = {
  kind: string;
  label: string;
  createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
  createRuntimeForEntry?: (params: {
    entry: UiNcpRuntimeEntry;
    runtimeParams: RuntimeFactoryParams;
  }) => NcpAgentRuntime;
  describeSessionType?: (params?: UiNcpSessionTypeDescribeParams) => Promise<Omit<UiNcpSessionTypeOption, "value" | "label"> | null | undefined>
    | Omit<UiNcpSessionTypeOption, "value" | "label">
    | null
    | undefined;
  describeSessionTypeForEntry?: (params: {
    entry: UiNcpRuntimeEntry;
    describeParams?: UiNcpSessionTypeDescribeParams;
  }) => Promise<Omit<UiNcpSessionTypeOption, "value" | "label"> | null | undefined>
    | Omit<UiNcpSessionTypeOption, "value" | "label">
    | null
    | undefined;
};

type RuntimeProviderRegistrationEntry = UiNcpRuntimeProviderRegistration & { token: symbol };

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function cloneRuntimeEntry(entry: UiNcpRuntimeEntry): UiNcpRuntimeEntry {
  return {
    id: entry.id,
    label: entry.label,
    type: entry.type,
    enabled: entry.enabled !== false,
    config: entry.config ? { ...entry.config } : {},
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

export class UiNcpRuntimeRegistry {
  private readonly providers = new Map<string, RuntimeProviderRegistrationEntry>();
  private entries = new Map<string, UiNcpRuntimeEntry>();
  private defaultEntryId = DEFAULT_UI_NCP_RUNTIME_ENTRY_ID;

  register(registration: UiNcpRuntimeProviderRegistration): Disposable {
    const normalizedKind = normalizeIdentifier(registration.kind);
    if (!normalizedKind) {
      throw new Error("ui ncp runtime kind must be a non-empty string");
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
  }

  applyEntries(params: {
    entries: UiNcpRuntimeEntry[];
    defaultEntryId?: string;
  }): void {
    const nextEntries = new Map<string, UiNcpRuntimeEntry>();
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
      (nextEntries.has(DEFAULT_UI_NCP_RUNTIME_ENTRY_ID)
        ? DEFAULT_UI_NCP_RUNTIME_ENTRY_ID
        : [...nextEntries.keys()][0] ?? DEFAULT_UI_NCP_RUNTIME_ENTRY_ID);
  }

  listProviderKinds(): string[] {
    return [...this.providers.keys()];
  }

  createRuntime(params: RuntimeFactoryParams): NcpAgentRuntime {
    const requestedEntryId =
      readRequestedRuntimeEntryId(params.sessionMetadata) ?? this.defaultEntryId;
    const entry = this.entries.get(requestedEntryId);
    if (!entry || entry.enabled === false) {
      throw new Error(`ncp runtime unavailable: ${requestedEntryId}`);
    }

    const provider = this.providers.get(entry.type);
    if (!provider) {
      throw new Error(`ncp runtime provider unavailable: ${entry.type}`);
    }

    const nextSessionMetadata = {
      ...params.sessionMetadata,
      runtime: entry.id,
      session_type: entry.id,
      runtime_type: entry.type,
    };
    params.setSessionMetadata(nextSessionMetadata);
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
  }

  async listSessionTypes(params?: UiNcpSessionTypeDescribeParams): Promise<{
    defaultType: string;
    options: UiNcpSessionTypeOption[];
  }> {
    const options = await Promise.all(
      [...this.entries.values()]
        .filter((entry) => entry.enabled !== false)
        .map(async (entry) => {
          const provider = this.providers.get(entry.type);
          if (!provider) {
            return {
              value: entry.id,
              label: entry.label,
              ready: false,
              reason: "runtime_provider_unavailable",
              reasonMessage: `Runtime provider unavailable for type "${entry.type}".`,
              recommendedModel: null,
              cta: {
                kind: "settings",
                label: "Configure Runtime",
              },
            } satisfies UiNcpSessionTypeOption;
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
            ready: descriptor?.ready ?? true,
            reason: descriptor?.reason ?? null,
            reasonMessage: descriptor?.reasonMessage ?? null,
            recommendedModel: descriptor?.recommendedModel ?? null,
            cta: descriptor?.cta ?? null,
            ...(descriptor?.supportedModels ? { supportedModels: descriptor.supportedModels } : {}),
          } satisfies UiNcpSessionTypeOption;
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
  }
}
