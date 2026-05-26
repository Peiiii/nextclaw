import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { AgentRunRuntimeContribution } from "@kernel/contributions/kernel-branch/contributions/agent-run-runtime/index.js";
import { ContextWindowContribution } from "@kernel/contributions/kernel-branch/contributions/context-window/index.js";
import { ContextProviderContribution } from "@kernel/contributions/kernel-branch/contributions/context-provider/index.js";
import {
  AgentRunContextCompactionManager,
  AgentRunRequestManager,
  AgentRuntimeManager,
  ContextProviderManager,
  SessionRepository,
  SessionRunManager,
  ToolProviderManager,
} from "@kernel/features/agent-run/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import type { AgentRuntimeSessionTypeDescribeParams } from "@kernel/features/runtime-registry/index.js";

export class KernelBranch implements KernelContribution {
  readonly agentRuntimeManager = new AgentRuntimeManager();
  readonly contextCompactionManager: AgentRunContextCompactionManager;
  readonly contextProviderManager = new ContextProviderManager();
  readonly sessionRepository: SessionRepository;
  readonly sessionRunManager: SessionRunManager;
  readonly toolProviderManager = new ToolProviderManager();
  readonly agentRunRequestManager: AgentRunRequestManager;
  private readonly contributions: KernelContribution[];
  private started = false;

  constructor(private readonly kernel: NextclawKernel) {
    this.sessionRepository = new SessionRepository(
      kernel.eventBus,
      kernel.ncpSessionManager,
    );
    this.contextCompactionManager = new AgentRunContextCompactionManager(
      kernel.configManager,
      kernel.llmProviders,
      this.sessionRepository,
    );
    this.sessionRunManager = new SessionRunManager(this.sessionRepository);
    this.agentRunRequestManager = new AgentRunRequestManager(
      this.agentRuntimeManager,
      kernel.configManager,
      this.contextProviderManager,
      kernel.eventBus,
      kernel.ingress,
      this.sessionRepository,
      this.sessionRunManager,
      this.toolProviderManager,
    );
    this.contributions = [
      new ContextProviderContribution(kernel, this),
      new ContextWindowContribution(kernel, this),
      new AgentRunRuntimeContribution(kernel, this),
    ];
  }

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.sessionRepository.start();
    for (const contribution of this.contributions) {
      contribution.start();
    }
    this.agentRunRequestManager.start();
  };

  listSessionTypes = (params?: AgentRuntimeSessionTypeDescribeParams) =>
    this.agentRuntimeManager.listSessionTypes(params);

  isSessionRunning = (sessionId: string): boolean =>
    this.sessionRunManager.isSessionRunning(sessionId);

  dispose = async (): Promise<void> => {
    if (!this.started) {
      return;
    }
    for (const contribution of [...this.contributions].reverse()) {
      await contribution.dispose?.();
    }
    this.agentRunRequestManager.dispose();
    this.toolProviderManager.dispose();
    this.contextProviderManager.dispose();
    await this.agentRuntimeManager.dispose();
    this.sessionRunManager.dispose();
    this.sessionRepository.dispose();
    this.started = false;
  };
}
