import type { NcpEndpointEvent, NcpTool } from "@nextclaw/ncp";
import type { SessionRun } from "./session-run.manager.js";
import type {
  AgentRunSpec,
  ContextBlock,
} from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import type {
  AgentRuntimeEntry,
  AgentRuntimeSessionTypeDescribeParams,
  AgentRuntimeSessionTypeOption,
} from "@kernel/features/runtime-registry/index.js";
import { describeAgentRuntimeSessionTypes } from "@kernel/features/runtime-registry/index.js";

export type AgentRuntimeRunOptions = {
  session: AgentRunSession;
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
  }) =>
    | Promise<
        | Omit<AgentRuntimeSessionTypeOption, "value" | "label">
        | null
        | undefined
      >
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

  register = (
    registration: AgentRuntimeRegistration,
  ): (() => Promise<void>) => {
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
    const { session, sessionRun } = params;
    const { cache, cacheKey, entry, provider } = this.resolveRuntimeCache(params);
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

  disposeRuntime = async (
    params: AgentRuntimeCacheParams,
  ): Promise<boolean> => {
    const { cache, cacheKey } = this.resolveRuntimeCache(params);
    const runtime = cache.get(cacheKey);
    if (!runtime) {
      return false;
    }
    cache.delete(cacheKey);
    await runtime.dispose?.();
    return true;
  };

  listSessionTypes = async (
    params?: AgentRuntimeSessionTypeDescribeParams,
  ): Promise<{
    defaultType: string;
    options: AgentRuntimeSessionTypeOption[];
  }> =>
    describeAgentRuntimeSessionTypes({
      entries: [...this.entries.values()],
      providers: this.providers,
      describeParams: params,
    });

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
    return entry.config?.reuseScope === "session" ||
      entry.config?.reuseScope === "global"
      ? entry.config.reuseScope
      : provider.defaultReuseScope;
  };

  private resolveRuntimeCache = (
    params: AgentRuntimeCacheParams,
  ): {
    cache: Map<string, AgentRuntime>;
    cacheKey: string;
    entry: AgentRuntimeEntry;
    provider: AgentRuntimeRegistration;
  } => {
    const { agentRuntimeId, session } = params;
    const entry = this.getEntry(agentRuntimeId);
    const provider = this.getProvider(entry.type);
    const reuseScope = this.resolveReuseScope(entry, provider);
    const cacheKey =
      reuseScope === "global" ? entry.id : `${entry.id}:${session.sessionId}`;
    const cache =
      reuseScope === "global" ? this.globalRuntimes : this.sessionRuntimes;
    return {
      cache,
      cacheKey,
      entry,
      provider,
    };
  };

  private disposeAllRuntimes = async (): Promise<void> => {
    for (const runtime of [
      ...this.globalRuntimes.values(),
      ...this.sessionRuntimes.values(),
    ]) {
      await runtime.dispose?.();
    }
    this.globalRuntimes.clear();
    this.sessionRuntimes.clear();
  };
}
