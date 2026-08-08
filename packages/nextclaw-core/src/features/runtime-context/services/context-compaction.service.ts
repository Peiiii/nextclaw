import { InputBudgetPruner } from "@core/features/agent/index.js";

type RuntimeMessage = Record<string, unknown>;
type ContextCompactionSummaryGenerator = (params: {
  maxInstallableSummaryTokens: number;
  maxInputTokens: number;
  maxTokens: number;
  messages: RuntimeMessage[];
  targetSummaryTokens: number;
}) => Promise<string>;

export const CONTEXT_COMPACTION_METADATA_KEY = "last_context_compaction";

export type ContextCompactionPhase = "pre-run" | "mid-run";

export type ContextCompactionCheckpoint = {
  version: 1;
  id: string;
  status: "compressing" | "compressed" | "failed" | "cancelled";
  phase?: ContextCompactionPhase;
  summary: string;
  coveredUntil?: string;
  continuationMessageId?: string;
  continuationMessageCoveredPartCount?: number;
  preservedUserMessageIds?: string[];
  retainedMessageIds?: string[];
  truncatedPreservedUserMessage?: {
    messageId: string;
    text: string;
  };
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
  fixedInputTokens: number;
  retainedMessages: RuntimeMessage[];
  preservableUserMessages: RuntimeMessage[];
  projectedTokenLimit: number;
  originalEstimatedTokens: number;
};

const RETAINED_CURRENT_MESSAGE_COUNT = 1;
const PRESERVED_USER_MESSAGE_MAX_TOKENS = 20_000;
const SUMMARY_MAX_TOKENS = 4_000;
const SUMMARY_MIN_TOKENS = 256;
const SUMMARY_AVAILABLE_TOKEN_SHARE = 0.5;
const SUMMARY_PROVIDER_MAX_TOKENS = 8_000;
const SUMMARY_PROVIDER_MIN_INPUT_TOKENS = 512;
const APPROXIMATE_CHARS_PER_TOKEN = 4;

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

function readMessageId(message: RuntimeMessage): string | null {
  return typeof message.ncp_message_id === "string" && message.ncp_message_id.length > 0
    ? message.ncp_message_id
    : null;
}

function toPreservedUserMessage(message: RuntimeMessage, content = message.content): RuntimeMessage {
  return {
    role: "user",
    content: structuredClone(content),
    ncp_message_id: readMessageId(message),
  };
}

function truncatePreservedUserMessage(text: string, maxTokens: number): string | null {
  const maxChars = maxTokens * APPROXIMATE_CHARS_PER_TOKEN;
  if (maxChars <= 32 || text.length <= maxChars) {
    return text.length <= maxChars ? text : null;
  }
  const omittedTokens = Math.max(1, Math.ceil((text.length - maxChars) / APPROXIMATE_CHARS_PER_TOKEN));
  const marker = `…${omittedTokens} tokens truncated…`;
  const retainedChars = maxChars - marker.length;
  if (retainedChars <= 16) {
    return null;
  }
  const headChars = Math.ceil(retainedChars / 2);
  const tailChars = retainedChars - headChars;
  return `${text.slice(0, headChars).trimEnd()}${marker}${text.slice(-tailChars).trimStart()}`;
}

export class ContextCompactionService {
  private readonly inputBudgetPruner = new InputBudgetPruner();

  prepareForModelInput = (params: {
    messages: RuntimeMessage[];
    contextTokens: number;
    compactionThresholdTokens?: number;
    fixedInputTokens?: number;
    preservableUserMessageIds?: readonly string[];
    projectedTokenLimit?: number;
    retainLatestMessage?: boolean;
  }): ContextCompactionPlan | null => {
    const {
      compactionThresholdTokens,
      contextTokens,
      fixedInputTokens = 0,
      messages,
      preservableUserMessageIds = [],
      projectedTokenLimit = contextTokens,
      retainLatestMessage = true,
    } = params;
    const originalEstimate = this.inputBudgetPruner.estimate({
      messages,
      contextTokens,
      fixedInputTokens,
    });
    const thresholdTokens = compactionThresholdTokens ?? originalEstimate.budgetTokens;
    if (originalEstimate.estimatedTokens < thresholdTokens) {
      return null;
    }

    const leadingSystemMessage = isSystemMessage(messages[0]) ? messages[0] : null;
    const conversationMessages = leadingSystemMessage ? messages.slice(1) : messages;
    const retainedMessageCount = retainLatestMessage ? RETAINED_CURRENT_MESSAGE_COUNT : 0;
    const coveredMessageCount = Math.max(0, conversationMessages.length - retainedMessageCount);
    const retainedMessages = conversationMessages.slice(coveredMessageCount);
    const coveredMessages = conversationMessages.slice(0, coveredMessageCount);
    if (coveredMessages.length === 0) {
      return null;
    }

    const preservableUserMessageIdSet = new Set(preservableUserMessageIds);
    return {
      messages,
      coveredMessages,
      fixedInputTokens,
      retainedMessages,
      preservableUserMessages: coveredMessages.filter((message) => {
        const messageId = readMessageId(message);
        return message.role === "user" && messageId !== null && preservableUserMessageIdSet.has(messageId);
      }),
      projectedTokenLimit,
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
      fixedInputTokens,
      messages,
      originalEstimatedTokens,
      preservableUserMessages,
      projectedTokenLimit,
      retainedMessages,
    } = plan;
    const createdAt = (now ?? new Date()).toISOString();
    const leadingSystemMessage = isSystemMessage(messages[0]) ? messages[0] : null;
    const summaryBaseEstimate = this.inputBudgetPruner.estimate({
      messages: [leadingSystemMessage, ...retainedMessages]
        .filter((message): message is RuntimeMessage => Boolean(message)),
      contextTokens,
      fixedInputTokens,
    });
    const summaryMessageOverhead = this.inputBudgetPruner.estimate({
      messages: [{ role: "user", content: "" }],
      contextTokens,
    }).estimatedTokens;
    const availableSummaryTokens = projectedTokenLimit
      - summaryBaseEstimate.estimatedTokens
      - summaryMessageOverhead;
    if (availableSummaryTokens < SUMMARY_MIN_TOKENS) {
      throw new Error(
        `Context compaction cannot fit a usable summary: ${Math.max(0, availableSummaryTokens)} tokens available, ${SUMMARY_MIN_TOKENS} required. Increase the agent contextTokens setting or reduce its fixed context and tools.`,
      );
    }
    const targetSummaryTokens = Math.min(
      SUMMARY_MAX_TOKENS,
      Math.max(SUMMARY_MIN_TOKENS, Math.floor(availableSummaryTokens * SUMMARY_AVAILABLE_TOKEN_SHARE)),
    );
    const summaryProviderMaxTokens = Math.min(
      SUMMARY_PROVIDER_MAX_TOKENS,
      Math.max(1, contextTokens - SUMMARY_PROVIDER_MIN_INPUT_TOKENS),
    );
    const summary = await generateSummary({
      maxInstallableSummaryTokens: availableSummaryTokens,
      maxInputTokens: Math.max(1, contextTokens - summaryProviderMaxTokens),
      maxTokens: summaryProviderMaxTokens,
      messages: coveredMessages.map((message) => structuredClone(message)),
      targetSummaryTokens,
    });
    const checkpointMessage: RuntimeMessage = {
      role: "user",
      content: summary,
    };
    const baseProjectedMessages = [
      leadingSystemMessage,
      checkpointMessage,
      ...retainedMessages,
    ].filter((message): message is RuntimeMessage => Boolean(message));
    const baseProjectedEstimate = this.inputBudgetPruner.estimate({
      messages: baseProjectedMessages,
      contextTokens,
      fixedInputTokens,
    });
    const preservedUserMessageTokenLimit = Math.min(
      PRESERVED_USER_MESSAGE_MAX_TOKENS,
      Math.max(0, projectedTokenLimit - baseProjectedEstimate.estimatedTokens),
    );
    const preserved = this.selectPreservedUserMessages({
      contextTokens,
      messages: preservableUserMessages,
      tokenLimit: preservedUserMessageTokenLimit,
    });
    const projectedMessages = [
      leadingSystemMessage,
      checkpointMessage,
      ...preserved.messages,
      ...retainedMessages,
    ].filter((message): message is RuntimeMessage => Boolean(message));
    const projectedEstimate = this.inputBudgetPruner.estimate({
      messages: projectedMessages,
      contextTokens,
      fixedInputTokens,
    });
    if (projectedEstimate.estimatedTokens > projectedTokenLimit) {
      throw new Error(
        `Context compaction output does not fit the model input budget: ${projectedEstimate.estimatedTokens} estimated tokens exceeds ${projectedTokenLimit}. The previous checkpoint was kept unchanged.`,
      );
    }
    const checkpoint: ContextCompactionCheckpoint = {
      version: 1,
      id: createCheckpointId(createdAt, coveredMessages.length),
      status: "compressed",
      summary,
      preservedUserMessageIds: preserved.messageIds,
      retainedMessageIds: retainedMessages.flatMap((message) => {
        const messageId = readMessageId(message);
        return messageId ? [messageId] : [];
      }),
      truncatedPreservedUserMessage: preserved.truncatedMessage,
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

  private selectPreservedUserMessages = (params: {
    contextTokens: number;
    messages: RuntimeMessage[];
    tokenLimit: number;
  }): {
    messageIds: string[];
    messages: RuntimeMessage[];
    truncatedMessage?: { messageId: string; text: string };
  } => {
    const { contextTokens, messages, tokenLimit } = params;
    const selectedMessages: RuntimeMessage[] = [];
    let remainingTokens = tokenLimit;
    let truncatedMessage: { messageId: string; text: string } | undefined;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message) {
        continue;
      }
      const messageId = readMessageId(message);
      if (!messageId || remainingTokens <= 0) {
        break;
      }
      const projectedMessage = toPreservedUserMessage(message);
      const estimatedTokens = this.inputBudgetPruner.estimate({
        messages: [projectedMessage],
        contextTokens,
      }).estimatedTokens;
      if (estimatedTokens <= remainingTokens) {
        selectedMessages.push(projectedMessage);
        remainingTokens -= estimatedTokens;
        continue;
      }
      if (typeof message.content !== "string") {
        break;
      }
      const messageOverheadTokens = this.inputBudgetPruner.estimate({
        messages: [toPreservedUserMessage(message, "")],
        contextTokens,
      }).estimatedTokens;
      const text = truncatePreservedUserMessage(
        message.content,
        Math.max(0, remainingTokens - messageOverheadTokens),
      );
      if (!text) {
        break;
      }
      selectedMessages.push(toPreservedUserMessage(message, text));
      truncatedMessage = { messageId, text };
      break;
    }
    selectedMessages.reverse();
    return {
      messageIds: selectedMessages.flatMap((message) => {
        const messageId = readMessageId(message);
        return messageId ? [messageId] : [];
      }),
      messages: selectedMessages,
      truncatedMessage,
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
