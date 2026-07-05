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
  coveredUntil?: string;
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
  retainedMessages: RuntimeMessage[];
  originalEstimatedTokens: number;
};

const RETAINED_CURRENT_MESSAGE_COUNT = 1;

function createCheckpointId(createdAt: string, coveredMessageCount: number): string {
  return `ctx-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${coveredMessageCount}`;
}

function isSystemMessage(message: RuntimeMessage | undefined): boolean {
  return message?.role === "system";
}

function readCoveredUntil(messages: RuntimeMessage[], fallback: string): string {
  const latestTimestamp = Math.max(
    ...messages
      .map((message) => typeof message.timestamp === "string" ? Date.parse(message.timestamp) : Number.NaN)
      .filter((millis): millis is number => Number.isFinite(millis)),
  );
  return Number.isFinite(latestTimestamp)
    ? new Date(latestTimestamp).toISOString()
    : fallback;
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
    const conversationMessages = leadingSystemMessage ? messages.slice(1) : messages;
    const retainedMessages = conversationMessages.slice(-RETAINED_CURRENT_MESSAGE_COUNT);
    const coveredMessages = conversationMessages.slice(0, -retainedMessages.length);
    if (coveredMessages.length === 0) {
      return null;
    }

    return {
      messages,
      coveredMessages,
      retainedMessages,
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
      retainedMessages,
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
      ...retainedMessages,
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
      coveredUntil: readCoveredUntil(coveredMessages, createdAt),
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
