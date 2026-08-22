import type { NcpEndpointEvent, NcpMessage, NcpTool } from "@nextclaw/ncp";
import type { SessionRun } from "./session-run.manager.js";
import type {
  AgentRunSpec,
  ContextBlock,
} from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import type {
  AgentRuntimeEntry,
  AgentRuntimeProviderRegistration,
  AgentRuntimeSessionTypeDescribeParams,
  AgentRuntimeSessionTypeOption,
} from "@kernel/features/runtime-registry/index.js";
import { describeAgentRuntimeSessionTypes } from "@kernel/features/runtime-registry/index.js";
import { NcpAgentRuntimeWrapper } from "@kernel/services/ncp-agent-runtime-wrapper.service.js";

export type AgentRuntimeRunOptions = {
  session: AgentRunSession;
  sessionRun: SessionRun;
  contextBlocks: readonly ContextBlock[];
  tools: readonly NcpTool[];
  initialMessages: readonly NcpMessage[];
  signal?: AbortSignal;
};

export type AgentRuntimeContextCompactionOptions = Pick<
  AgentRuntimeRunOptions,
  "session" | "sessionRun"
>;

export type AgentRuntimeContextCompactionResult = {
  events: readonly NcpEndpointEvent[];
  performed: boolean;
  supported: boolean;
};

export type AgentRuntime = {
  capabilities?: {
    nextStepInput?: boolean;
  };
  run: (
    spec: AgentRunSpec,
    options: AgentRuntimeRunOptions,
  ) => AsyncIterable<NcpEndpointEvent>;
  compactContext?: (
    options: AgentRuntimeContextCompactionOptions,
  ) => Promise<AgentRuntimeContextCompactionResult>;
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
  private readonly configuredEntries = new Map<string, AgentRuntimeEntry>();
  private readonly contributedEntries = new Map<string, AgentRuntimeEntry>();
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

  registerProvider = (
    provider: AgentRuntimeProviderRegistration,
    host: { resolveAssetContentPath: (assetUri: string) => string | null },
  ): (() => Promise<void>) =>
    this.register({
      kind: provider.kind,
      label: provider.label,
      defaultReuseScope: "session",
      describeSessionTypeForEntry: provider.describeSessionTypeForEntry,
      createRuntime: ({ entry, session }) =>
        new NcpAgentRuntimeWrapper({
          injectNextclawContext: entry.injectNextclawContext !== false,
          createRuntime: ({ resolveTools, stateManager }) => {
            const runtimeParams = {
              ...(session.agentId ? { agentId: session.agentId } : {}),
              resolveAssetContentPath: host.resolveAssetContentPath,
              resolveTools,
              sessionMetadata: session.metadata,
              stateManager,
            };
            return provider.createRuntimeForEntry
              ? provider.createRuntimeForEntry({ entry, runtimeParams })
              : provider.createRuntime(runtimeParams);
          },
        }),
    });

  applyEntries = (entries: readonly AgentRuntimeEntry[]): void => {
    const nextEntries = new Map<string, AgentRuntimeEntry>();
    for (const entry of entries) {
      const id = this.normalizeId(entry.id);
      if (this.contributedEntries.has(id)) {
        throw new Error(`Agent runtime entry is already registered: ${id}`);
      }
      nextEntries.set(id, {
        ...entry,
        id,
        type: this.normalizeId(entry.type),
      });
    }
    this.configuredEntries.clear();
    for (const [id, entry] of nextEntries) {
      this.configuredEntries.set(id, entry);
    }
    this.rebuildEntries();
  };

  registerEntry = (entry: AgentRuntimeEntry): (() => Promise<void>) => {
    const id = this.normalizeId(entry.id);
    if (this.entries.has(id)) {
      throw new Error(`Agent runtime entry is already registered: ${id}`);
    }
    const normalizedEntry = {
      ...entry,
      id,
      type: this.normalizeId(entry.type),
    };
    this.contributedEntries.set(id, normalizedEntry);
    this.rebuildEntries();
    return async () => {
      if (this.contributedEntries.get(id) !== normalizedEntry) {
        return;
      }
      this.contributedEntries.delete(id);
      this.rebuildEntries();
      await this.disposeAllRuntimes();
    };
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
    this.configuredEntries.clear();
    this.contributedEntries.clear();
  };

  private normalizeId = (agentRuntimeId: string): string => {
    const normalizedId = agentRuntimeId.trim();
    if (!normalizedId) {
      throw new Error("Agent runtime id is required.");
    }
    return normalizedId;
  };

  private rebuildEntries = (): void => {
    this.entries.clear();
    for (const entry of this.configuredEntries.values()) {
      this.entries.set(entry.id, entry);
    }
    for (const entry of this.contributedEntries.values()) {
      if (this.entries.has(entry.id)) {
        throw new Error(`Agent runtime entry is already registered: ${entry.id}`);
      }
      this.entries.set(entry.id, entry);
    }
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
