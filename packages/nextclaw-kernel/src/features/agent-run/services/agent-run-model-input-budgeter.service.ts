import {
  ContextWindowBudgetService,
  findEffectiveAgentProfile,
  InputBudgetPruner,
  resolveDefaultAgentProfileId,
  type InputBudgetPruneResult,
} from "@nextclaw/core";
import type { OpenAIChatMessage } from "@nextclaw/ncp";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { AgentRunSpec } from "@kernel/features/agent-run/types/agent-run.types.js";

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

  constructor(private readonly configManager: ConfigManager) {}

  prune = async (
    params: AgentRunModelInputBudgeterPruneParams,
  ): Promise<AgentRunModelInputBudgeterPruneResult> => {
    const config = this.configManager.loadConfig();
    const defaultAgentId = resolveDefaultAgentProfileId(config);
    const profile =
      findEffectiveAgentProfile(config, params.spec.agentId) ??
      findEffectiveAgentProfile(config, defaultAgentId);
    const contextTokens = profile?.contextTokens ?? config.agents.defaults.contextTokens;
    const reservedContextTokens = ContextWindowBudgetService.resolveReservedContextTokens({
      contextTokens,
      configuredReservedContextTokens:
        profile?.reservedContextTokens ?? config.agents.defaults.reservedContextTokens,
    });
    const pruned = this.inputBudgetPruner.prune({
      messages: params.messages.map((message) => ({ ...message })),
      contextTokens,
      reserveTokensFloor: reservedContextTokens,
      softThresholdTokens: 0,
    });

    return {
      ...pruned,
      messages: pruned.messages as OpenAIChatMessage[],
    };
  };
}
