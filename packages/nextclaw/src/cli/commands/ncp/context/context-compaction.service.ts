import { InputBudgetPruner } from "@nextclaw/core";

type RuntimeMessage = Record<string, unknown>;

export const CONTEXT_COMPACTION_METADATA_KEY = "last_context_compaction";

export type ContextCompactionCheckpoint = {
  version: 1;
  id: string;
  status: "compressing" | "compressed";
  summary: string;
  coveredMessageCount: number;
  coveredSessionMessageCount: number;
  coveredUntilMessageId?: string;
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
const MAX_SUMMARY_CHARS = 12_000;
const MAX_MESSAGE_EXCERPT_CHARS = 900;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value ?? "");
  } catch {
    return String(value ?? "");
  }
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxChars - 32)).trimEnd()}\n[truncated]`;
}

function createCheckpointId(createdAt: string, coveredMessageCount: number): string {
  return `ctx-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${coveredMessageCount}`;
}

export class ContextCompactionService {
  private readonly inputBudgetPruner = new InputBudgetPruner();

  compactForModelInput = (params: {
    messages: RuntimeMessage[];
    contextTokens: number;
    sessionHistoryMessageIds?: string[];
    now?: Date;
  }): ContextCompactionResult => {
    const { contextTokens, messages, now, sessionHistoryMessageIds } = params;
    const originalEstimate = this.inputBudgetPruner.estimate({
      messages,
      contextTokens,
    });
    if (originalEstimate.estimatedTokens <= originalEstimate.budgetTokens) {
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
    const summary = this.buildSummary(coveredMessages);
    const checkpointMessage: RuntimeMessage = {
      role: "user",
      content: summary,
    };
    const recentHistory = keptMessages.slice(0, -1);
    const currentTurn = keptMessages.at(-1);
    const projectedMessages = [
      messages[0],
      checkpointMessage,
      ...recentHistory,
      currentTurn,
    ].filter((message): message is RuntimeMessage => Boolean(message));
    const projectedEstimate = this.inputBudgetPruner.estimate({
      messages: projectedMessages,
      contextTokens,
    });
    const coveredSessionMessageCount = Array.isArray(sessionHistoryMessageIds)
      ? Math.max(0, sessionHistoryMessageIds.length - RECENT_TAIL_MESSAGES)
      : coveredMessages.length;
    const coveredUntilMessageId =
      coveredSessionMessageCount > 0 && Array.isArray(sessionHistoryMessageIds)
        ? sessionHistoryMessageIds[coveredSessionMessageCount - 1]
        : undefined;
    const checkpoint: ContextCompactionCheckpoint = {
      version: 1,
      id: createCheckpointId(createdAt, coveredMessages.length),
      status: "compressed",
      summary,
      coveredMessageCount: coveredMessages.length,
      coveredSessionMessageCount,
      ...(coveredUntilMessageId ? { coveredUntilMessageId } : {}),
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
    const history = messages.slice(1, -1);
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

  private buildSummary = (messages: RuntimeMessage[]): string => {
    const lines = [
      "# Compressed Earlier Context",
      "",
      "The following is a compact checkpoint of earlier conversation turns. Original session messages are preserved in storage; this checkpoint only replaces the covered older turns for the current model input.",
      "",
      `Covered messages: ${messages.length}`,
      "",
    ];
    for (const [index, message] of messages.entries()) {
      const role = readString(message.role) || "message";
      const name = readString(message.name);
      const content = truncateText(stringifyContent(message.content).trim(), MAX_MESSAGE_EXCERPT_CHARS);
      if (!content) {
        continue;
      }
      lines.push(`## ${index + 1}. ${role}${name ? ` (${name})` : ""}`);
      lines.push(content);
      lines.push("");
    }
    return truncateText(lines.join("\n").trim(), MAX_SUMMARY_CHARS);
  };
}
