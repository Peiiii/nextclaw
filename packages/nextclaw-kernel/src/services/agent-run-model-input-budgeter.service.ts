import {
  InputBudgetPruner,
  type InputBudgetPruneResult,
} from "@nextclaw/core";
import type { OpenAIChatMessage } from "@nextclaw/ncp";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { AgentRunSpec } from "@kernel/types/agent-run.types.js";

export type AgentRunModelInputBudgeterPruneParams = {
  spec: AgentRunSpec;
  messages: readonly OpenAIChatMessage[];
};

export type AgentRunModelInputBudgeterPruneResult = Omit<
  InputBudgetPruneResult,
  "messages"
> & {
  messages: OpenAIChatMessage[];
};

export class AgentRunModelInputBudgeter {
  private readonly inputBudgetPruner = new InputBudgetPruner();

  constructor(private readonly agentManager: AgentManager) {}

  prune = async (
    params: AgentRunModelInputBudgeterPruneParams,
  ): Promise<AgentRunModelInputBudgeterPruneResult> => {
    const profile = this.agentManager.resolveAgentProfile(params.spec.agentId);
    const pruned = this.inputBudgetPruner.prune({
      messages: params.messages.map((message) => ({ ...message })),
      contextTokens: profile.contextTokens,
      reserveTokensFloor: profile.reservedContextTokens,
      softThresholdTokens: 0,
    });

    return {
      ...pruned,
      messages: pruned.messages as OpenAIChatMessage[],
    };
  };
}
