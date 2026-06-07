import { InputBudgetPruner } from "@core/features/agent/index.js";

type RuntimeMessage = Record<string, unknown>;
type ContextCompactionSummaryGenerator = (params: {
  messages: RuntimeMessage[];
}) => Promise<string>;

export const CONTEXT_COMPACTION_METADATA_KEY = "last_context_compaction";

export type ContextCompactionCheckpoint = {
  version: 1;
  id: string;
  status: "compressing" | "compressed";
  summary: string;
  coveredMessageCount: number;
  coveredSessionMessageCount: number;
  originalEstimatedTokens: number;
  projectedEstimatedTokens: number;
  createdAt: string;
  updatedAt: string;
};

export type ContextCompactionResult = {
  messages: RuntimeMessage[];
  checkpoint: ContextCompactionCheckpoint | null;
};

export type ContextCompactionPlan = {
  messages: RuntimeMessage[];
  coveredMessages: RuntimeMessage[];
  originalEstimatedTokens: number;
};

const MIN_MESSAGES_TO_COMPACT = 8;

function createCheckpointId(createdAt: string, coveredMessageCount: number): string {
  return `ctx-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${coveredMessageCount}`;
}

function isSystemMessage(message: RuntimeMessage | undefined): boolean {
  return message?.role === "system";
}

export class ContextCompactionService {
  private readonly inputBudgetPruner = new InputBudgetPruner();

  prepareForModelInput = (params: {
    messages: RuntimeMessage[];
    contextTokens: number;
    compactionThresholdTokens?: number;
  }): ContextCompactionPlan | null => {
    const { compactionThresholdTokens, contextTokens, messages } = params;
    const originalEstimate = this.inputBudgetPruner.estimate({
      messages,
      contextTokens,
    });
    const thresholdTokens = compactionThresholdTokens ?? originalEstimate.budgetTokens;
    if (originalEstimate.estimatedTokens < thresholdTokens) {
      return null;
    }

    const leadingSystemMessage = isSystemMessage(messages[0]) ? messages[0] : null;
    const coveredMessages = leadingSystemMessage ? messages.slice(1) : messages;
    if (coveredMessages.length < MIN_MESSAGES_TO_COMPACT) {
      return null;
    }

    return {
      messages,
      coveredMessages,
      originalEstimatedTokens: originalEstimate.estimatedTokens,
    };
  };

  compactPreparedForModelInput = async (params: {
    contextTokens: number;
    generateSummary: ContextCompactionSummaryGenerator;
    now?: Date;
    plan: ContextCompactionPlan;
  }): Promise<ContextCompactionResult> => {
    const { contextTokens, generateSummary, now, plan } = params;
    const {
      coveredMessages,
      messages,
      originalEstimatedTokens,
    } = plan;
    const createdAt = (now ?? new Date()).toISOString();
    const summary = await generateSummary({
      messages: coveredMessages.map((message) => structuredClone(message)),
    });
    const checkpointMessage: RuntimeMessage = {
      role: "user",
      content: summary,
    };
    const leadingSystemMessage = isSystemMessage(messages[0]) ? messages[0] : null;
    const projectedMessages = [
      leadingSystemMessage,
      checkpointMessage,
    ].filter((message): message is RuntimeMessage => Boolean(message));
    const projectedEstimate = this.inputBudgetPruner.estimate({
      messages: projectedMessages,
      contextTokens,
    });
    const checkpoint: ContextCompactionCheckpoint = {
      version: 1,
      id: createCheckpointId(createdAt, coveredMessages.length),
      status: "compressed",
      summary,
      coveredMessageCount: coveredMessages.length,
      coveredSessionMessageCount: coveredMessages.length,
      originalEstimatedTokens,
      projectedEstimatedTokens: projectedEstimate.estimatedTokens,
      createdAt,
      updatedAt: createdAt,
    };

    return {
      messages: projectedMessages,
      checkpoint,
    };
  };

}

export function readCompressedContextCompactionCheckpoint(value: unknown): ContextCompactionCheckpoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const checkpoint = value as Partial<ContextCompactionCheckpoint>;
  return checkpoint.version === 1 && checkpoint.status === "compressed" && typeof checkpoint.summary === "string"
    ? (checkpoint as ContextCompactionCheckpoint)
    : null;
}
