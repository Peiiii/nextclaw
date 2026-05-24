import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { AgentRuntimeContribution } from "@kernel/contributions/agent-runtime/index.js";
import { SessionContextWindowContribution } from "@kernel/contributions/session-context-window/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import type { AgentRuntimeSessionTypeDescribeParams } from "@kernel/features/runtime-registry/index.js";

export class LegacyAgentRunContribution implements KernelContribution {
  private readonly contributions: KernelContribution[];
  private started = false;

  constructor(private readonly kernel: NextclawKernel) {
    this.contributions = [
      new AgentRuntimeContribution(kernel),
      new SessionContextWindowContribution(kernel),
    ];
  }

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    for (const contribution of this.contributions) {
      contribution.start();
    }
    this.kernel.agentRunRequestManager.start();
  };

  listSessionTypes = (params?: AgentRuntimeSessionTypeDescribeParams) =>
    this.kernel.agentRuntimeManager.listSessionTypes(params);

  dispose = async (): Promise<void> => {
    if (!this.started) {
      return;
    }
    await this.kernel.agentRunRequestManager.dispose();
    await this.kernel.sessionRunManager.dispose();
    for (const contribution of [...this.contributions].reverse()) {
      await contribution.dispose();
    }
    this.started = false;
  };
}
