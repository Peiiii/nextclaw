import { InputBudgetPruner } from "@nextclaw/core";

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

const MIN_MESSAGES_TO_COMPACT = 8;
const RECENT_TAIL_MESSAGES = 6;
function createCheckpointId(createdAt: string, coveredMessageCount: number): string {
  return `ctx-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${coveredMessageCount}`;
}

function isSystemMessage(message: RuntimeMessage | undefined): boolean {
  return message?.role === "system";
}

export class ContextCompactionService {
  private readonly inputBudgetPruner = new InputBudgetPruner();

  compactForModelInput = async (params: {
    messages: RuntimeMessage[];
    contextTokens: number;
    compactionThresholdTokens?: number;
    generateSummary: ContextCompactionSummaryGenerator;
    now?: Date;
  }): Promise<ContextCompactionResult> => {
    const { compactionThresholdTokens, contextTokens, generateSummary, messages, now } = params;
    const originalEstimate = this.inputBudgetPruner.estimate({
      messages,
      contextTokens,
    });
    const thresholdTokens = compactionThresholdTokens ?? originalEstimate.budgetTokens;
    if (originalEstimate.estimatedTokens < thresholdTokens) {
      return {
        messages,
        checkpoint: null,
      };
    }

    const { coveredMessages, keptMessages } = this.splitMessages(messages);
    if (coveredMessages.length < MIN_MESSAGES_TO_COMPACT) {
      return {
        messages,
        checkpoint: null,
      };
    }

    const createdAt = (now ?? new Date()).toISOString();
    const summary = await generateSummary({
      messages: coveredMessages.map((message) => structuredClone(message)),
    });
    const checkpointMessage: RuntimeMessage = {
      role: "user",
      content: summary,
    };
    const recentHistory = keptMessages.slice(0, -1);
    const currentTurn = keptMessages.at(-1);
    const leadingSystemMessage = isSystemMessage(messages[0]) ? messages[0] : null;
    const projectedMessages = [
      leadingSystemMessage,
      checkpointMessage,
      ...recentHistory,
      currentTurn,
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
      originalEstimatedTokens: originalEstimate.estimatedTokens,
      projectedEstimatedTokens: projectedEstimate.estimatedTokens,
      createdAt,
      updatedAt: createdAt,
    };

    return {
      messages: projectedMessages,
      checkpoint,
    };
  };

  private splitMessages = (
    messages: RuntimeMessage[],
  ): { coveredMessages: RuntimeMessage[]; keptMessages: RuntimeMessage[] } => {
    const historyStartIndex = isSystemMessage(messages[0]) ? 1 : 0;
    const history = messages.slice(historyStartIndex, -1);
    const currentTurn = messages.at(-1);
    const tailStart = Math.max(0, history.length - RECENT_TAIL_MESSAGES);
    return {
      coveredMessages: history.slice(0, tailStart),
      keptMessages: [
        ...history.slice(tailStart),
        ...(currentTurn ? [currentTurn] : []),
      ],
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
