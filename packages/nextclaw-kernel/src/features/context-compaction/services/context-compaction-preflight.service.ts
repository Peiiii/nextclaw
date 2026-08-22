import {
  estimateInputTokens,
  CONTEXT_COMPACTION_METADATA_KEY,
  ContextCompactionService,
  ContextWindowBudgetService,
  buildCompressingCompactionCheckpoint,
  buildContextWindowSnapshot,
  readCompressedContextCompactionCheckpoint,
  type ContextCompactionCheckpoint,
  type ContextCompactionPhase,
  type ContextCompactionPlan,
  type ContextWindowBudgetEvaluation,
  type ContextWindowSnapshot,
} from "@nextclaw/core";
import { type NcpMessage, type NcpTool } from "@nextclaw/ncp";
import { CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY } from "@nextclaw/shared";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import { toLegacyMessages } from "@kernel/utils/ncp-message-bridge.utils.js";
import {
  buildContextBlockInputMessages,
  estimateToolInputTokens,
} from "@kernel/utils/agent-model-input-budget.utils.js";
import { ContextCompactionSummaryGenerationService } from "./context-compaction-summary-generation.service.js";
import {
  buildContextCompactionModelProjection,
  buildContextCompactionTimelineNcpMessage,
  CONTEXT_COMPACTION_CONTINUATION_TEXT,
  CONTEXT_COMPACTION_SYSTEM_PREAMBLE,
  createContextCompactionMessageId,
  isContextCompactionTimelineMessage,
  readLatestContextCompactionCheckpoint,
} from "@kernel/features/context-compaction/utils/context-compaction.utils.js";

export type ContextCompactionPreflightResult = {
  contextWindow: ContextWindowSnapshot;
  sessionMessages: NcpMessage[];
  timelineMessage: NcpMessage | null;
};

export type ContextCompactionPreflightBeginResult = {
  contextWindow: ContextWindowSnapshot;
  sessionMessages: NcpMessage[];
  pendingCompaction: ContextCompactionPendingWork | null;
};

export type ContextCompactionTrigger = "automatic" | "manual";

type ContinuationMessageBoundary = {
  messageId: string;
  coveredPartCount: number;
};

type ContextCompactionPendingWork = {
  checkpoint: ReturnType<typeof buildCompressingCompactionCheckpoint>;
  contextBlockMessages: Record<string, unknown>[];
  continuationMessageBoundary: ContinuationMessageBoundary | null;
  contextTokens: number;
  phase: ContextCompactionPhase;
  serviceMessageId: string;
  model: string;
  plan: ContextCompactionPlan;
  reservedContextTokens: number;
  snapshotFixedInputTokens: number;
  sessionId: string;
  sessionMessages: NcpMessage[];
};

type ResolvedCompactionProfile = {
  contextTokens: number;
  reservedContextTokens: number;
};

function estimateCompactionProjectionOverhead(phase: ContextCompactionPhase): number {
  const summaryPlanOverhead = estimateInputTokens({ role: "user", content: "" });
  const summaryProjectionOverhead = estimateInputTokens({
    role: "system",
    content: `${CONTEXT_COMPACTION_SYSTEM_PREAMBLE}\n\n`,
  });
  const continuationTokens = phase === "mid-run"
    ? estimateInputTokens({ role: "user", content: CONTEXT_COMPACTION_CONTINUATION_TEXT })
    : 0;
  return Math.max(0, summaryProjectionOverhead - summaryPlanOverhead) + continuationTokens;
}

function mergeInputMessages(params: {
  inputMessages: readonly NcpMessage[];
  sessionMessages: readonly NcpMessage[];
}): NcpMessage[] {
  const messages = params.sessionMessages.map((message) => structuredClone(message));
  const seen = new Set(messages.map((message) => message.id));
  for (const message of params.inputMessages) {
    if (seen.has(message.id)) {
      continue;
    }
    messages.push(structuredClone(message));
  }
  return messages;
}

function readContinuationMessageBoundary(
  messages: readonly NcpMessage[],
): ContinuationMessageBoundary | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message?.role === "assistant" &&
      (message.status === "pending" || message.status === "streaming")
    ) {
      return {
        messageId: message.id,
        coveredPartCount: message.parts.length,
      };
    }
  }
  return null;
}

function readPreRunContinuationBoundary(
  messages: readonly NcpMessage[],
): ContinuationMessageBoundary | null {
  const continuationPrompt = messages.at(-1);
  const targetMessageId = continuationPrompt?.metadata?.[
    CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY
  ];
  if (typeof targetMessageId !== "string" || !targetMessageId.trim()) {
    return null;
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const target = messages[index];
    if (target?.id === targetMessageId && target.role === "assistant") {
      return { messageId: target.id, coveredPartCount: target.parts.length };
    }
  }
  return null;
}

function buildContextWindowSnapshotFromBudget(params: {
  budget: ContextWindowBudgetEvaluation;
  checkpoint: ContextCompactionCheckpoint | null;
  completeInputBudget: boolean;
  fixedInputTokens: number;
  reservedContextTokens: number;
  totalContextTokens: number;
}): ContextWindowSnapshot {
  const {
    budget,
    checkpoint,
    completeInputBudget,
    fixedInputTokens,
    reservedContextTokens,
    totalContextTokens,
  } = params;
  return buildContextWindowSnapshot({
    usedContextTokens: budget.estimatedTokens,
    completeInputBudget,
    totalContextTokens,
    fixedInputTokens,
    reservedContextTokens,
    triggerContextTokens: budget.triggerTokens,
    prunedUsedContextTokens: budget.estimatedTokens,
    droppedHistoryCount: budget.droppedHistoryCount,
    truncatedToolResultCount: budget.truncatedToolResultCount,
    truncatedSystemPrompt: budget.truncatedSystemPrompt,
    truncatedUserMessage: budget.truncatedUserMessage,
    checkpoint,
    compactedUsedContextTokens: checkpoint ? budget.estimatedTokens : undefined,
  });
}

export class ContextCompactionPreflightService {
  private readonly compactionService = new ContextCompactionService();
  private readonly contextWindowBudgetService = new ContextWindowBudgetService();
  private readonly summaryGenerationService: ContextCompactionSummaryGenerationService;

  constructor(
    private readonly agentManager: AgentManager,
    providerManager?: LlmProviderRuntime,
  ) {
    this.summaryGenerationService = new ContextCompactionSummaryGenerationService(providerManager);
  }

  preview = (params: {
    completeInputBudget?: boolean;
    contextBlocks?: readonly string[];
    fixedInputTokens?: number;
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
    storedMetadata: Record<string, unknown>;
    tools?: readonly NcpTool[];
  }): ContextWindowSnapshot | null => {
    const {
      completeInputBudget = false,
      contextBlocks = [],
      fixedInputTokens,
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
      tools = [],
    } = params;
    const profile = this.resolveCompactionProfile({
      requestMetadata,
      storedAgentId,
    });
    const existingCheckpoint = readCompressedContextCompactionCheckpoint(
      storedMetadata[CONTEXT_COMPACTION_METADATA_KEY],
    ) ?? readLatestContextCompactionCheckpoint(sessionMessages);
    const projectedMessages = existingCheckpoint
      ? buildContextCompactionModelProjection({
          sessionId,
          sessionMessages,
        }).messages
      : sessionMessages.filter((message) => !isContextCompactionTimelineMessage(message));
    const contextBlockMessages = buildContextBlockInputMessages(contextBlocks);
    const contextBlockInputTokens = estimateInputTokens(contextBlockMessages);
    const toolInputTokens = estimateToolInputTokens(tools);
    const snapshotFixedInputTokens = fixedInputTokens
      ?? contextBlockInputTokens + toolInputTokens;
    const messages = [
      ...(fixedInputTokens === undefined ? contextBlockMessages : []),
      ...toLegacyMessages(projectedMessages) as Record<string, unknown>[],
    ];
    const budget = this.contextWindowBudgetService.evaluate({
      messages,
      contextTokens: profile.contextTokens,
      fixedInputTokens: fixedInputTokens
        ?? toolInputTokens,
      reservedContextTokens: profile.reservedContextTokens,
    });
    return buildContextWindowSnapshotFromBudget({
      budget,
      checkpoint: existingCheckpoint,
      completeInputBudget,
      fixedInputTokens: snapshotFixedInputTokens,
      reservedContextTokens: profile.reservedContextTokens,
      totalContextTokens: profile.contextTokens,
    });
  };

  begin = (params: {
    contextBlocks?: readonly string[];
    inputMessages: readonly NcpMessage[];
    model: string;
    phase?: ContextCompactionPhase;
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
    storedMetadata: Record<string, unknown>;
    tools?: readonly NcpTool[];
    trigger?: ContextCompactionTrigger;
  }): ContextCompactionPreflightBeginResult => {
    const {
      contextBlocks = [],
      inputMessages,
      model,
      phase = "pre-run",
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
      tools = [],
      trigger = "automatic",
    } = params;
    const profile = this.resolveCompactionProfile({
      requestMetadata,
      storedAgentId,
    });
    const { contextTokens, reservedContextTokens } = profile;
    const ncpMessages = mergeInputMessages({
      inputMessages,
      sessionMessages,
    });
    const continuationMessageBoundary = phase === "mid-run"
      ? readContinuationMessageBoundary(ncpMessages)
      : readPreRunContinuationBoundary(ncpMessages);
    const existingCheckpoint = readCompressedContextCompactionCheckpoint(
      storedMetadata[CONTEXT_COMPACTION_METADATA_KEY],
    ) ?? readLatestContextCompactionCheckpoint(ncpMessages);
    const projectedMessages = existingCheckpoint
      ? buildContextCompactionModelProjection({
          sessionId,
          sessionMessages: ncpMessages,
        }).messages
      : ncpMessages.filter((message) => !isContextCompactionTimelineMessage(message));
    const contextBlockMessages = buildContextBlockInputMessages(contextBlocks);
    const messages = [
      ...contextBlockMessages,
      ...toLegacyMessages(projectedMessages) as Record<string, unknown>[],
    ];
    const preservableUserMessageIds = ncpMessages.flatMap((message) =>
      message.role === "user" ? [message.id] : [],
    );
    const fixedInputTokens = estimateToolInputTokens(tools);
    const snapshotFixedInputTokens = estimateInputTokens(contextBlockMessages) + fixedInputTokens;
    const budget = this.contextWindowBudgetService.evaluate({
      messages,
      contextTokens,
      fixedInputTokens,
      reservedContextTokens,
    });
    const plan = trigger === "automatic" && !budget.shouldCompact
      ? null
      : this.compactionService.prepareForModelInput({
          messages,
          contextTokens,
          compactionThresholdTokens: trigger === "manual" ? 0 : budget.triggerTokens,
          fixedInputTokens,
          preservableUserMessageIds,
          projectedTokenLimit: Math.max(1, budget.triggerTokens - (
            estimateCompactionProjectionOverhead(phase)
          )),
          retainLatestMessage: phase === "pre-run",
        });
    const coveredSessionMessageCount = plan
      ? (existingCheckpoint?.coveredSessionMessageCount ?? 0) + plan.coveredMessages.length - (existingCheckpoint ? 1 : 0)
      : 0;
    const serviceMessageId = createContextCompactionMessageId();
    const checkpoint = plan
      ? {
          ...buildCompressingCompactionCheckpoint(
            storedMetadata[CONTEXT_COMPACTION_METADATA_KEY],
          ),
          phase,
          continuationMessageId: continuationMessageBoundary?.messageId,
          continuationMessageCoveredPartCount:
            continuationMessageBoundary?.coveredPartCount,
          coveredMessageCount: coveredSessionMessageCount,
          coveredSessionMessageCount,
          originalEstimatedTokens: plan.originalEstimatedTokens,
          projectedEstimatedTokens: budget.estimatedTokens,
        }
      : existingCheckpoint;

    const contextWindow = buildContextWindowSnapshotFromBudget({
      budget,
      checkpoint,
      completeInputBudget: true,
      fixedInputTokens: snapshotFixedInputTokens,
      reservedContextTokens,
      totalContextTokens: contextTokens,
    });
    return {
      contextWindow,
      sessionMessages: ncpMessages,
      pendingCompaction: plan && checkpoint
        ? {
            checkpoint,
            contextBlockMessages,
            continuationMessageBoundary,
            contextTokens,
            phase,
            serviceMessageId,
            model,
            plan,
            reservedContextTokens,
            snapshotFixedInputTokens,
            sessionId,
            sessionMessages: ncpMessages,
          }
        : null,
    };
  };

  finish = async (
    pending: ContextCompactionPendingWork,
    signal?: AbortSignal,
  ): Promise<ContextCompactionPreflightResult> => {
    let summaryDiagnostics: ContextCompactionCheckpoint["summaryDiagnostics"];
    const compacted = await this.compactionService.compactPreparedForModelInput({
      contextTokens: pending.contextTokens,
      plan: pending.plan,
      generateSummary: async ({
        maxInputTokens,
        maxInstallableSummaryTokens,
        maxTokens,
        messages,
        targetSummaryTokens,
      }) => {
        const generated = await this.summaryGenerationService.generate({
          maxInputTokens,
          maxInstallableSummaryTokens,
          maxTokens,
          messages,
          model: pending.model,
          signal,
          targetSummaryTokens,
        });
        summaryDiagnostics = generated.diagnostics;
        return generated.summary;
      },
    });
    const generatedCheckpoint = compacted.checkpoint;
    if (!generatedCheckpoint) {
      throw new Error("context compaction pending work did not produce a checkpoint");
    }
    const checkpoint: ContextCompactionCheckpoint = {
      ...generatedCheckpoint,
      id: pending.checkpoint.id,
      createdAt: pending.checkpoint.createdAt,
      phase: pending.phase,
      continuationMessageId: pending.continuationMessageBoundary?.messageId,
      continuationMessageCoveredPartCount:
        pending.continuationMessageBoundary?.coveredPartCount,
      coveredMessageCount: pending.checkpoint.coveredMessageCount,
      coveredSessionMessageCount: pending.checkpoint.coveredSessionMessageCount,
      summaryDiagnostics: summaryDiagnostics!,
      status: "compressed" as const,
    };
    const timelineMessage = buildContextCompactionTimelineNcpMessage({
      messageId: pending.serviceMessageId,
      sessionId: pending.sessionId,
      checkpoint,
    });
    const projectedMessages = buildContextCompactionModelProjection({
      sessionId: pending.sessionId,
      sessionMessages: [...pending.sessionMessages, timelineMessage],
    }).messages;
    const budget = this.contextWindowBudgetService.evaluate({
      messages: [
        ...pending.contextBlockMessages,
        ...toLegacyMessages(projectedMessages, { serviceRole: "system" }) as Record<string, unknown>[],
      ],
      contextTokens: pending.contextTokens,
      fixedInputTokens: pending.plan.fixedInputTokens,
      reservedContextTokens: pending.reservedContextTokens,
    });
    if (budget.estimatedTokens > budget.triggerTokens) {
      throw new Error(
        `Context compaction checkpoint does not fit the final provider input surface: ${budget.estimatedTokens} estimated tokens exceeds ${budget.triggerTokens}. The previous checkpoint was kept unchanged.`,
      );
    }
    const contextWindow = buildContextWindowSnapshotFromBudget({
      budget,
      checkpoint,
      completeInputBudget: true,
      fixedInputTokens: pending.snapshotFixedInputTokens,
      reservedContextTokens: pending.reservedContextTokens,
      totalContextTokens: pending.contextTokens,
    });
    return {
      contextWindow,
      sessionMessages: pending.sessionMessages,
      timelineMessage,
    };
  };

  private resolveCompactionProfile = (params: {
    requestMetadata: Record<string, unknown>;
    storedAgentId?: string;
  }): ResolvedCompactionProfile => {
    const profile = this.agentManager.resolveAgentProfileForRun({
      requestMetadata: params.requestMetadata,
      storedAgentId: params.storedAgentId,
    });
    return {
      contextTokens: profile.contextTokens,
      reservedContextTokens: profile.reservedContextTokens,
    };
  };
}
