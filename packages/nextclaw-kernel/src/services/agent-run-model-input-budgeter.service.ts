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
  fixedInputTokens?: number;
  protectedPrefixMessageCount?: number;
  protectedSystemContentChars?: number;
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
    const {
      messages,
      fixedInputTokens,
      protectedPrefixMessageCount,
      protectedSystemContentChars,
      spec,
    } = params;
    const profile = this.agentManager.resolveAgentProfile(spec.agentId);
    const pruned = this.inputBudgetPruner.prune({
      messages: messages.map((message) => ({ ...message })),
      contextTokens: profile.contextTokens,
      fixedInputTokens,
      reserveTokensFloor: profile.reservedContextTokens,
      softThresholdTokens: 0,
      protectedPrefixMessageCount,
      protectedSystemContentChars,
    });
    if (pruned.estimatedTokens > pruned.budgetTokens) {
      if ((protectedPrefixMessageCount ?? 0) > 0) {
        throw new Error("Model input cannot fit without mutating the compressed-context stable prefix.");
      }
      throw new Error(
        `Model input cannot fit the configured context window: ${pruned.estimatedTokens} estimated tokens exceeds ${pruned.budgetTokens}. Increase the agent contextTokens setting or reduce its fixed context and tools.`,
      );
    }

    return {
      ...pruned,
      messages: pruned.messages as OpenAIChatMessage[],
    };
  };
}
