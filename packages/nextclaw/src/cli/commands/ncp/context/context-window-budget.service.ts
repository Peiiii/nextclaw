import { InputBudgetPruner, type InputBudgetPrepareResult } from "@nextclaw/core";

type RuntimeMessage = Record<string, unknown>;

const MODEL_MESSAGE_FIELDS = [
  "role",
  "content",
  "name",
  "tool_call_id",
  "tool_calls",
  "reasoning_content",
] as const;
const DEFAULT_RESERVED_CONTEXT_TOKENS_CAP = 10_000;
const DEFAULT_RESERVED_CONTEXT_RATIO = 0.2;

export type ContextWindowBudgetEvaluation = InputBudgetPrepareResult & {
  shouldCompact: boolean;
  triggerTokens: number;
};

export class ContextWindowBudgetService {
  private readonly inputBudgetPruner = new InputBudgetPruner();

  static resolveReservedContextTokens(params: {
    configuredReservedContextTokens?: number | null;
    contextTokens: number;
  }): number {
    const { configuredReservedContextTokens, contextTokens } = params;
    const reservedContextTokens = configuredReservedContextTokens
      ?? Math.min(
        DEFAULT_RESERVED_CONTEXT_TOKENS_CAP,
        Math.floor(contextTokens * DEFAULT_RESERVED_CONTEXT_RATIO),
      );
    ContextWindowBudgetService.assertValidReserve({ contextTokens, reservedContextTokens });
    return reservedContextTokens;
  }

  static assertValidReserve(params: {
    contextTokens: number;
    reservedContextTokens: number;
  }): void {
    const { contextTokens, reservedContextTokens } = params;
    if (!Number.isInteger(reservedContextTokens) || reservedContextTokens < 0) {
      throw new Error("reservedContextTokens must be a non-negative integer");
    }
    if (!Number.isInteger(contextTokens) || contextTokens <= 0) {
      throw new Error("contextTokens must be a positive integer");
    }
    if (reservedContextTokens >= contextTokens) {
      throw new Error(
        `reservedContextTokens (${reservedContextTokens}) must be smaller than contextTokens (${contextTokens})`,
      );
    }
  }

  evaluate = (params: {
    contextTokens: number;
    messages: RuntimeMessage[];
    reservedContextTokens: number;
  }): ContextWindowBudgetEvaluation => {
    const { contextTokens, reservedContextTokens } = params;
    ContextWindowBudgetService.assertValidReserve({ contextTokens, reservedContextTokens });
    const prepared = this.inputBudgetPruner.prepareForBudget({
      messages: params.messages.map(stripToModelInputMessage),
      contextTokens,
      reserveTokensFloor: reservedContextTokens,
      softThresholdTokens: 0,
    });
    const triggerTokens = contextTokens - reservedContextTokens;
    return {
      ...prepared,
      shouldCompact: prepared.estimatedTokens >= triggerTokens,
      triggerTokens,
    };
  };
}

function stripToModelInputMessage(message: RuntimeMessage): RuntimeMessage {
  const modelMessage: RuntimeMessage = {};
  for (const field of MODEL_MESSAGE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(message, field)) {
      modelMessage[field] = structuredClone(message[field]);
    }
  }
  return modelMessage;
}
