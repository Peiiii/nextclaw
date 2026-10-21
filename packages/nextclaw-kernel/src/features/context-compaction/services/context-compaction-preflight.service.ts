import {
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
} from "@nextclaw/core/context-compaction";
import { estimateInputTokens } from "@nextclaw/core/model-input-budget";
import { type NcpMessage, type NcpTool } from "@nextclaw/ncp";
import {
  ncpMessageToOpenAiMessageGroups,
  type LocalAssetStore,
} from "@nextclaw/ncp-agent-runtime";
import { CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY } from "@nextclaw/shared";
import {
  buildContextBlockInputMessages,
  estimateToolInputTokens,
} from "@kernel/utils/agent-model-input-budget.utils.js";
import { ContextCompactionSummaryGenerationService, type CompactionSummaryProvider } from "./context-compaction-summary-generation.service.js";

export type CompactionProfileResolver = {
  resolveAgentProfileForRun(input: {
    requestMetadata: Record<string, unknown>;
    storedAgentId?: string;
  }): { contextTokens: number; reservedContextTokens: number };
};
export type { CompactionSummaryProvider } from "./context-compaction-summary-generation.service.js";
import {
  buildContextCompactionModelProjection,
  buildContextCompactionTimelineNcpMessage,
  CONTEXT_COMPACTION_CONTINUATION_TEXT,
  CONTEXT_COMPACTION_PART_START,
  CONTEXT_COMPACTION_SYSTEM_PREAMBLE,
  CONTEXT_COMPACTION_RECOVERY_PREAMBLE,
  createContextCompactionMessageId,
  isContextCompactionProjectionMessage,
  isContextCompactionTimelineMessage,
  readLatestContextCompactionCheckpoint,
  readContextRecoveryState,
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
  overflow: boolean;
  originalBudget: ContextWindowBudgetEvaluation;
  priorCheckpoint: ContextCompactionCheckpoint | null;
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

function toCompactionModelMessages(
  messages: readonly NcpMessage[],
  assetStore: LocalAssetStore | null,
): Record<string, unknown>[] {
  return messages.flatMap((message) =>
    ncpMessageToOpenAiMessageGroups(message, { assetStore }).flatMap((group, index, groups) => group.messages.map((providerMessage) => ({
      ...providerMessage,
      ncp_message_id: message.id,
      ncp_part_start: group.partStart + Number(message.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0),
      ncp_part_end: (groups[index + 1]?.partStart ?? message.parts.length)
        + Number(message.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0),
      timestamp: message.timestamp,
    }))),
  );
}

function estimateCompactionProjectionOverhead(phase: ContextCompactionPhase): number {
  const summaryPlanOverhead = estimateInputTokens({ role: "user", content: "" });
  const summaryProjectionOverhead = estimateInputTokens({
    role: "system",
    content: `${CONTEXT_COMPACTION_SYSTEM_PREAMBLE}\n\n${CONTEXT_COMPACTION_RECOVERY_PREAMBLE}\n\n`,
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
        coveredPartCount: Number(message.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0) + message.parts.length,
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
      return { messageId: target.id, coveredPartCount: Number(target.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0) + target.parts.length };
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
  private readonly deferredAttempts = new Map<string, { model: string; tokens: number }>();
  private readonly compactionService = new ContextCompactionService();
  private readonly contextWindowBudgetService = new ContextWindowBudgetService();
  private readonly summaryGenerationService: ContextCompactionSummaryGenerationService;

  constructor(
    private readonly agentManager: CompactionProfileResolver,
    providerManager?: CompactionSummaryProvider,
    private readonly assetStore: LocalAssetStore | null = null,
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
      ...toCompactionModelMessages(projectedMessages, this.assetStore),
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
    overflow?: boolean;
    maxOutputTokens?: number;
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
    const contextTokens = profile.contextTokens;
    const reservedContextTokens = Math.max(profile.reservedContextTokens, params.maxOutputTokens ?? 0);
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
      ...toCompactionModelMessages(projectedMessages, this.assetStore),
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
    const hardInputLimit = contextTokens - reservedContextTokens;
    const archivePressure = readContextRecoveryState(ncpMessages, existingCheckpoint).unresolvedArchive;
    const structuralPressure = archivePressure || ncpMessages.length > 256 || ncpMessages.reduce((count, message) => count + message.parts.length, 0) > 1_024;
    const deferred = this.deferredAttempts.get(sessionId);
    const retryGrowth = Math.max(1, Math.floor((hardInputLimit - budget.triggerTokens) / 2));
    const throttled = !params.overflow && trigger === "automatic" && budget.estimatedTokens <= hardInputLimit
      && deferred?.model === model && budget.estimatedTokens < deferred.tokens + retryGrowth;
    const plan = trigger === "automatic" && ((!budget.shouldCompact && !params.overflow && !structuralPressure) || (throttled && !structuralPressure))
      ? null
      : this.compactionService.prepareForModelInput({
          messages,
          coverLeadingSystemMessage:
            contextBlockMessages.length === 0
            && isContextCompactionProjectionMessage(projectedMessages[0]),
          contextTokens,
          compactionThresholdTokens: trigger === "manual" || params.overflow || structuralPressure ? 0 : budget.triggerTokens,
          fixedInputTokens,
          preservableUserMessageIds,
          projectedTokenLimit: Math.max(1, Math.min(hardInputLimit,
            params.overflow ? Math.floor(budget.estimatedTokens * 0.7) : Math.max(budget.triggerTokens, snapshotFixedInputTokens + 1_024)) - (
            estimateCompactionProjectionOverhead(phase)
          )),
          retainLatestMessage: phase === "pre-run",
          retainRecentTokens: 20_000,
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
            originalBudget: budget,
            overflow: params.overflow === true,
            priorCheckpoint: existingCheckpoint,
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
          requestId: pending.serviceMessageId,
          sessionId: pending.sessionId,
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
    signal?.throwIfAborted();
    if ((summaryDiagnostics?.recovery === "deterministic-recent-context" || summaryDiagnostics?.sourceTruncated)
      && !pending.overflow && !pending.sessionMessages.some(message => message.metadata?.nextclaw_archived_body)
      && pending.originalBudget.estimatedTokens <= pending.contextTokens - pending.reservedContextTokens) {
      // Discard the candidate; nothing from an unsuccessful summary replaces the old view.
      this.deferredAttempts.delete(pending.sessionId);
      this.deferredAttempts.set(pending.sessionId, { model: pending.model, tokens: pending.originalBudget.estimatedTokens });
      if (this.deferredAttempts.size > 512) this.deferredAttempts.delete(this.deferredAttempts.keys().next().value!);
      return {
        contextWindow: buildContextWindowSnapshotFromBudget({
          budget: pending.originalBudget, checkpoint: pending.priorCheckpoint,
          completeInputBudget: true, fixedInputTokens: pending.snapshotFixedInputTokens,
          reservedContextTokens: pending.reservedContextTokens, totalContextTokens: pending.contextTokens,
        }),
        sessionMessages: pending.sessionMessages,
        timelineMessage: buildContextCompactionTimelineNcpMessage({
          messageId: pending.serviceMessageId, sessionId: pending.sessionId,
          checkpoint: { ...pending.checkpoint, status: "failed", summaryDiagnostics, updatedAt: new Date().toISOString() },
        }),
      };
    }
    this.deferredAttempts.delete(pending.sessionId);
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
      ...(summaryDiagnostics?.recovery === "deterministic-recent-context" || summaryDiagnostics?.sourceTruncated || readContextRecoveryState(pending.sessionMessages, pending.priorCheckpoint).required
        ? { recovery: {
          required: true as const,
          reason: summaryDiagnostics?.recovery === "deterministic-recent-context"
            ? "summary-unavailable" as const : "unresolved-archive" as const,
          archiveThrough: pending.sessionMessages.reduce((latest, message) => Date.parse(message.timestamp) > Date.parse(latest) ? message.timestamp : latest,
            generatedCheckpoint.coveredUntil ?? generatedCheckpoint.updatedAt),
          checkpointId: summaryDiagnostics?.recovery === "deterministic-recent-context" || summaryDiagnostics?.sourceTruncated
            || readContextRecoveryState(pending.sessionMessages, pending.priorCheckpoint).unresolvedArchive ? pending.checkpoint.id
            : pending.priorCheckpoint?.recovery?.checkpointId ?? pending.priorCheckpoint?.id ?? pending.checkpoint.id,
        } } : {}),
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
        ...toCompactionModelMessages(projectedMessages, this.assetStore),
      ],
      contextTokens: pending.contextTokens,
      fixedInputTokens: pending.plan.fixedInputTokens,
      reservedContextTokens: pending.reservedContextTokens,
    });
    if (budget.estimatedTokens > pending.contextTokens - pending.reservedContextTokens) {
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
