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
import type {
  AgentRuntimeSessionTypeDescribeParams,
  AgentRuntimeSessionTypeIcon,
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
  id: string;
  label?: string;
  icon?: AgentRuntimeSessionTypeIcon | null;
  createRuntime: () => AgentRuntime;
};

export class AgentRuntimeManager {
  private readonly registrations = new Map<string, AgentRuntimeRegistration>();
  private readonly runtimes = new Map<string, AgentRuntime>();

  register = (registration: AgentRuntimeRegistration): (() => Promise<void>) => {
    const id = this.normalizeId(registration.id);
    if (this.registrations.has(id)) {
      throw new Error(`Agent runtime is already registered: ${id}`);
    }
    const normalizedRegistration = {
      ...registration,
      id,
    };
    this.registrations.set(id, normalizedRegistration);
    return async () => {
      if (this.registrations.get(id) !== normalizedRegistration) {
        return;
      }
      this.registrations.delete(id);
      await this.disposeRuntime(id);
    };
  };

  getOrCreate = (agentRuntimeId: string): AgentRuntime => {
    const normalizedId = this.normalizeId(agentRuntimeId);
    const existing = this.runtimes.get(normalizedId);
    if (existing) {
      return existing;
    }
    const registration = this.registrations.get(normalizedId);
    if (!registration) {
      throw new Error(`Agent runtime is not registered: ${normalizedId}`);
    }
    const agentRuntime = registration.createRuntime();
    this.runtimes.set(normalizedId, agentRuntime);
    return agentRuntime;
  };

  listSessionTypes = async (
    _params?: AgentRuntimeSessionTypeDescribeParams,
  ): Promise<{
    defaultType: string;
    options: AgentRuntimeSessionTypeOption[];
  }> => {
    const registrations = [...this.registrations.values()];
    return {
      defaultType: this.registrations.has(DEFAULT_AGENT_RUNTIME_ENTRY_ID)
        ? DEFAULT_AGENT_RUNTIME_ENTRY_ID
        : registrations[0]?.id ?? DEFAULT_AGENT_RUNTIME_ENTRY_ID,
      options: registrations.map((registration) => ({
        value: registration.id,
        label: registration.label ?? registration.id,
        icon: registration.icon ?? null,
        ready: true,
        reason: null,
        reasonMessage: null,
        recommendedModel: null,
        cta: null,
      })),
    };
  };

  dispose = async (): Promise<void> => {
    for (const id of [...this.runtimes.keys()]) {
      await this.disposeRuntime(id);
    }
    this.registrations.clear();
  };

  private normalizeId = (agentRuntimeId: string): string => {
    const normalizedId = agentRuntimeId.trim();
    if (!normalizedId) {
      throw new Error("Agent runtime id is required.");
    }
    return normalizedId;
  };

  private disposeRuntime = async (runtimeId: string): Promise<void> => {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) {
      return;
    }
    this.runtimes.delete(runtimeId);
    await runtime.dispose?.();
  };
}
