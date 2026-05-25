import type {
  NcpEndpointEvent,
  NcpTool,
} from "@nextclaw/ncp";
import type { SessionRun } from "./session-run.manager.js";
import type {
  AgentRunSpec,
  ContextBlock,
} from "@kernel/features/agent-run/types/agent-run.types.js";
import { DEFAULT_AGENT_RUNTIME_ENTRY_ID } from "@kernel/configs/agent-runtime.config.js";
import type { AgentRunSession } from "@kernel/features/agent-run/repositories/session.repository.js";
import type {
  AgentRuntimeEntry,
  AgentRuntimeSessionTypeDescribeParams,
  AgentRuntimeSessionTypeOption,
} from "@kernel/features/runtime-registry/index.js";

export type AgentRuntimeRunOptions = {
  sessionRun: SessionRun;
  contextBlocks: readonly ContextBlock[];
  tools: readonly NcpTool[];
  signal?: AbortSignal;
};

export type AgentRuntime = {
  run: (
    spec: AgentRunSpec,
    options: AgentRuntimeRunOptions,
  ) => AsyncIterable<NcpEndpointEvent>;
  dispose?: () => Promise<void> | void;
};

export type AgentRuntimeRegistration = {
  kind: string;
  label: string;
  defaultReuseScope: AgentRuntimeReuseScope;
  createRuntime: (params: AgentRuntimeCreateParams) => AgentRuntime;
  describeSessionTypeForEntry?: (params: {
    entry: AgentRuntimeEntry;
    describeParams?: AgentRuntimeSessionTypeDescribeParams;
  }) => Promise<Omit<AgentRuntimeSessionTypeOption, "value" | "label"> | null | undefined>
    | Omit<AgentRuntimeSessionTypeOption, "value" | "label">
    | null
    | undefined;
};

export type AgentRuntimeReuseScope = "global" | "session";

export type AgentRuntimeCreateParams = {
  entry: AgentRuntimeEntry;
  session: AgentRunSession;
  sessionRun: SessionRun;
};

type AgentRuntimeCacheParams = {
  agentRuntimeId: string;
  session: AgentRunSession;
  sessionRun: SessionRun;
};

export class AgentRuntimeManager {
  private readonly providers = new Map<string, AgentRuntimeRegistration>();
  private readonly entries = new Map<string, AgentRuntimeEntry>();
  private readonly globalRuntimes = new Map<string, AgentRuntime>();
  private readonly sessionRuntimes = new Map<string, AgentRuntime>();

  register = (registration: AgentRuntimeRegistration): (() => Promise<void>) => {
    const kind = this.normalizeId(registration.kind);
    if (this.providers.has(kind)) {
      throw new Error(`Agent runtime provider is already registered: ${kind}`);
    }
    const normalizedRegistration = {
      ...registration,
      kind,
    };
    this.providers.set(kind, normalizedRegistration);
    return async () => {
      if (this.providers.get(kind) !== normalizedRegistration) {
        return;
      }
      this.providers.delete(kind);
      await this.disposeAllRuntimes();
    };
  };

  applyEntries = (entries: readonly AgentRuntimeEntry[]): void => {
    this.entries.clear();
    for (const entry of entries) {
      this.entries.set(this.normalizeId(entry.id), {
        ...entry,
        id: this.normalizeId(entry.id),
        type: this.normalizeId(entry.type),
      });
    }
  };

  getOrCreate = (params: AgentRuntimeCacheParams): AgentRuntime => {
    const { agentRuntimeId, session, sessionRun } = params;
    const entry = this.getEntry(agentRuntimeId);
    const provider = this.getProvider(entry.type);
    const reuseScope = this.resolveReuseScope(entry, provider);
    const cacheKey = reuseScope === "global"
      ? entry.id
      : `${entry.id}:${session.sessionId}`;
    const cache = reuseScope === "global"
      ? this.globalRuntimes
      : this.sessionRuntimes;
    const existing = cache.get(cacheKey);
    if (existing) {
      return existing;
    }
    const agentRuntime = provider.createRuntime({
      entry,
      session,
      sessionRun,
    });
    cache.set(cacheKey, agentRuntime);
    return agentRuntime;
  };

  listSessionTypes = async (
    _params?: AgentRuntimeSessionTypeDescribeParams,
  ): Promise<{
    defaultType: string;
    options: AgentRuntimeSessionTypeOption[];
  }> => {
    const entries = [...this.entries.values()].filter((entry) => entry.enabled !== false);
    const options = await Promise.all(entries.map(async (entry) => {
      const provider = this.providers.get(entry.type);
      const descriptor = provider?.describeSessionTypeForEntry
        ? await provider.describeSessionTypeForEntry({ entry, describeParams: _params })
        : null;
      return {
        value: entry.id,
        label: entry.label,
        icon: descriptor?.icon ?? entry.icon ?? null,
        ready: provider ? descriptor?.ready ?? true : false,
        reason: provider ? descriptor?.reason ?? null : "runtime_provider_unavailable",
        reasonMessage: provider
          ? descriptor?.reasonMessage ?? null
          : `Runtime provider unavailable for type "${entry.type}".`,
        recommendedModel: descriptor?.recommendedModel ?? null,
        cta: descriptor?.cta ?? null,
        ...(descriptor?.supportedModels ? { supportedModels: descriptor.supportedModels } : {}),
      } satisfies AgentRuntimeSessionTypeOption;
    }));
    return {
      defaultType: this.entries.has(DEFAULT_AGENT_RUNTIME_ENTRY_ID)
        ? DEFAULT_AGENT_RUNTIME_ENTRY_ID
        : entries[0]?.id ?? DEFAULT_AGENT_RUNTIME_ENTRY_ID,
      options,
    };
  };

  dispose = async (): Promise<void> => {
    await this.disposeAllRuntimes();
    this.providers.clear();
    this.entries.clear();
  };

  private normalizeId = (agentRuntimeId: string): string => {
    const normalizedId = agentRuntimeId.trim();
    if (!normalizedId) {
      throw new Error("Agent runtime id is required.");
    }
    return normalizedId;
  };

  private getEntry = (agentRuntimeId: string): AgentRuntimeEntry => {
    const normalizedId = this.normalizeId(agentRuntimeId);
    const entry = this.entries.get(normalizedId);
    if (!entry || entry.enabled === false) {
      throw new Error(`Agent runtime entry is not registered: ${normalizedId}`);
    }
    return entry;
  };

  private getProvider = (kind: string): AgentRuntimeRegistration => {
    const provider = this.providers.get(this.normalizeId(kind));
    if (!provider) {
      throw new Error(`Agent runtime provider is not registered: ${kind}`);
    }
    return provider;
  };

  private resolveReuseScope = (
    entry: AgentRuntimeEntry,
    provider: AgentRuntimeRegistration,
  ): AgentRuntimeReuseScope => {
    return entry.config?.reuseScope === "session" || entry.config?.reuseScope === "global"
      ? entry.config.reuseScope
      : provider.defaultReuseScope;
  };

  private disposeAllRuntimes = async (): Promise<void> => {
    for (const runtime of [...this.globalRuntimes.values(), ...this.sessionRuntimes.values()]) {
      await runtime.dispose?.();
    }
    this.globalRuntimes.clear();
    this.sessionRuntimes.clear();
  };
}
