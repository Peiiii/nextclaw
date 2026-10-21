import {
  InputBudgetPruner,
  type InputBudgetPruneResult,
} from "@nextclaw/core/model-input-budget";
import type { OpenAIChatMessage } from "@nextclaw/ncp";
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

export type AgentModelInputBudgetProfileResolver = {
  resolveAgentProfile(agentId: string): { contextTokens: number; reservedContextTokens: number };
};

export class AgentRunModelInputBudgeter {
  private readonly inputBudgetPruner = new InputBudgetPruner();

  constructor(private readonly agentManager: AgentModelInputBudgetProfileResolver) {}

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
    const reserveTokens = Math.max(profile.reservedContextTokens, spec.maxTokens ?? 0);
    const estimate = this.inputBudgetPruner.estimate({ messages: [...messages], contextTokens: profile.contextTokens,
      fixedInputTokens, reserveTokensFloor: reserveTokens, softThresholdTokens: 0 });
    if (estimate.estimatedTokens > estimate.budgetTokens) throw Object.assign(new Error(
      (protectedPrefixMessageCount ?? 0) > 0
        ? `Model input cannot fit without mutating the compressed-context stable prefix: ${estimate.estimatedTokens} > ${estimate.budgetTokens}.`
        : `Model input cannot fit the configured context window: ${estimate.estimatedTokens} > ${estimate.budgetTokens}.`,
    ), { code: "MODEL_INPUT_OVERFLOW" });
    const pruned = this.inputBudgetPruner.prune({
      messages: messages.map((message) => ({ ...message })),
      contextTokens: profile.contextTokens,
      fixedInputTokens,
      reserveTokensFloor: reserveTokens,
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
    if (pruned.droppedHistoryCount || pruned.truncatedToolResultCount || pruned.truncatedSystemPrompt || pruned.truncatedUserMessage) {
      throw Object.assign(new Error("Model input requires a durable context reduction before it can be sent."), { code: "MODEL_INPUT_OVERFLOW" });
    }

    return {
      ...pruned,
      messages: pruned.messages as OpenAIChatMessage[],
    };
  };
}
