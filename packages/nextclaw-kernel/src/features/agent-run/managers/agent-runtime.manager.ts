import type {
  NcpEndpointEvent,
  NcpTool,
} from "@nextclaw/ncp";
import type { SessionRun } from "./session-run.manager.js";
import type {
  AgentRunSpec,
  ContextBlock,
} from "@kernel/features/agent-run/types/agent-run.types.js";

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

  getOrCreate = (agentRuntimeId = "default"): AgentRuntime => {
    const normalizedId = this.normalizeId(agentRuntimeId);
    const existing = this.runtimes.get(normalizedId);
    if (existing) {
      return existing;
    }
    const registration = this.registrations.get(normalizedId);
    if (!registration) {
      throw new Error(`Agent runtime is not registered: ${normalizedId}`);
    }
    const runtime = registration.createRuntime();
    this.runtimes.set(normalizedId, runtime);
    return runtime;
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

  private disposeRuntime = async (agentRuntimeId: string): Promise<void> => {
    const runtime = this.runtimes.get(agentRuntimeId);
    if (!runtime) {
      return;
    }
    this.runtimes.delete(agentRuntimeId);
    await runtime.dispose?.();
  };
}
