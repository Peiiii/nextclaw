import {
  findEffectiveAgentProfile,
  type ContextCompactionCheckpoint,
  type ContextCompactionPlan,
  ContextCompactionService,
  ContextWindowBudgetService,
  type ContextWindowBudgetEvaluation,
  buildContextWindowSnapshot,
  buildCompressingCompactionCheckpoint,
  CONTEXT_COMPACTION_METADATA_KEY,
  readCompressedContextCompactionCheckpoint,
  resolveDefaultAgentProfileId,
  type Config,
  type ContextWindowSnapshot,
} from "@nextclaw/core";
import {
  type NcpAgentRunInput,
  type NcpEndpointEvent,
  NcpEventType,
  type NcpMessage,
} from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import {
  normalizeString,
  toLegacyMessages,
} from "@kernel/utils/ncp-message-bridge.utils.js";
import {
  buildContextCompactionTimelineNcpMessage,
  isContextCompactionTimelineMessage,
} from "@kernel/features/context-compaction/utils/context-compaction-timeline-message.utils.js";
import { projectNcpMessagesWithContextCompaction } from "@kernel/features/context-compaction/utils/context-compaction-projection.utils.js";

export type ContextWindowOwner = "nextclaw" | "runtime";

export type ContextCompactionResult = {
  contextWindow: ContextWindowSnapshot;
  metadata: Record<string, unknown>;
  sessionMessages: NcpMessage[];
  timelineMessage: NcpMessage | null;
};

export type ContextCompactionBeginResult = ContextCompactionResult & {
  pendingCompaction: ContextCompactionPendingWork | null;
};

export type ContextCompactionPendingWork = {
  checkpoint: ReturnType<typeof buildCompressingCompactionCheckpoint>;
  contextTokens: number;
  inputMessageIds: string[];
  model: string;
  plan: ContextCompactionPlan;
  reservedContextTokens: number;
  sessionId: string;
  sessionMessages: NcpMessage[];
};

const SUMMARY_MAX_TOKENS = 4000;
const SUMMARY_SOURCE_MAX_CHARS = 120_000;

type ResolvedCompactionProfile = {
  contextTokens: number;
  model: string;
  reservedContextTokens: number;
};

function readRequestedAgentId(metadata: Record<string, unknown>): string | null {
  return normalizeString(metadata.agent_id)?.toLowerCase() ?? normalizeString(metadata.agentId)?.toLowerCase() ?? null;
}

function resolveCompactionProfile(params: {
  config: Config;
  requestMetadata: Record<string, unknown>;
  storedAgentId?: string;
}): ResolvedCompactionProfile {
  const { config, requestMetadata, storedAgentId } = params;
  const { defaults } = config.agents;
  const defaultAgentId = resolveDefaultAgentProfileId(config);
  const agentId =
    normalizeString(storedAgentId)?.toLowerCase() ??
    readRequestedAgentId(requestMetadata) ??
    defaultAgentId;
  const profile =
    findEffectiveAgentProfile(config, agentId) ??
    findEffectiveAgentProfile(config, defaultAgentId);
  return {
    contextTokens: profile?.contextTokens ?? defaults.contextTokens,
    model: profile?.model ?? defaults.model,
    reservedContextTokens: ContextWindowBudgetService.resolveReservedContextTokens({
      contextTokens: profile?.contextTokens ?? defaults.contextTokens,
      configuredReservedContextTokens: profile?.reservedContextTokens ?? defaults.reservedContextTokens,
    }),
  };
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

function stringifyCompactionSource(messages: readonly Record<string, unknown>[]): string {
  const json = JSON.stringify(messages, null, 2);
  if (json.length <= SUMMARY_SOURCE_MAX_CHARS) {
    return json;
  }
  return `${json.slice(0, SUMMARY_SOURCE_MAX_CHARS).trimEnd()}\n[truncated_source]`;
}

function buildContextWindowSnapshotFromBudget(params: {
  budget: ContextWindowBudgetEvaluation;
  checkpoint: ContextCompactionCheckpoint | null;
  totalContextTokens: number;
}): ContextWindowSnapshot {
  const { budget, checkpoint, totalContextTokens } = params;
  return buildContextWindowSnapshot({
    usedContextTokens: budget.estimatedTokens,
    totalContextTokens,
    prunedUsedContextTokens: budget.estimatedTokens,
    droppedHistoryCount: budget.droppedHistoryCount,
    truncatedToolResultCount: budget.truncatedToolResultCount,
    truncatedSystemPrompt: budget.truncatedSystemPrompt,
    truncatedUserMessage: budget.truncatedUserMessage,
    checkpoint,
    compactedUsedContextTokens: checkpoint ? budget.estimatedTokens : undefined,
  });
}

function createContextWindowUpdatedEvent(params: {
  contextWindow: ContextWindowSnapshot;
  sessionId: string;
}): NcpEndpointEvent {
  return {
    type: NcpEventType.ContextWindowUpdated,
    payload: {
      sessionId: params.sessionId,
      contextWindow: params.contextWindow,
    },
  };
}

export class ContextCompactionManager {
  private readonly compactionService = new ContextCompactionService();
  private readonly contextWindowBudgetService = new ContextWindowBudgetService();

  constructor(
    private readonly options: {
      getConfig: () => Config;
      providerManager?: LlmProviderRuntime;
    },
  ) {}

  runLivePreflight = async function* (
    this: ContextCompactionManager,
    params: {
      input: NcpAgentRunInput;
      onSessionUpdated: (sessionId: string) => void;
      stateManager: RuntimeFactoryParams["stateManager"];
      storedAgentId?: string;
      storedMetadata: Record<string, unknown>;
      updateSessionMetadata: (metadata: Record<string, unknown>) => void;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const { input, onSessionUpdated, stateManager, storedAgentId, storedMetadata, updateSessionMetadata } = params;
    const beginResult = this.begin({
      contextWindowOwner: "nextclaw",
      inputMessages: input.messages,
      requestMetadata: input.metadata ?? {},
      sessionId: input.sessionId,
      sessionMessages: stateManager.getSnapshot().messages,
      storedAgentId,
      storedMetadata,
    });
    if (!beginResult) {
      return;
    }
    updateSessionMetadata(beginResult.metadata);
    onSessionUpdated(input.sessionId);
    yield* this.publishLivePreflightResult({
      input,
      result: beginResult,
      stateManager,
    });
    if (!beginResult.pendingCompaction) {
      return;
    }
    const finishResult = await this.finish(beginResult.pendingCompaction);
    updateSessionMetadata(finishResult.metadata);
    onSessionUpdated(input.sessionId);
    yield* this.publishLivePreflightResult({
      input,
      result: finishResult,
      stateManager,
    });
  };

  preview = (params: {
    contextWindowOwner: ContextWindowOwner;
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
    storedMetadata: Record<string, unknown>;
  }): ContextWindowSnapshot | null => {
    const {
      contextWindowOwner,
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
    } = params;
    if (contextWindowOwner === "runtime") {
      return null;
    }
    const metadata = storedMetadata;
    const profile = resolveCompactionProfile({
      config: this.options.getConfig(),
      requestMetadata,
      storedAgentId,
    });
    const existingCheckpoint = readCompressedContextCompactionCheckpoint(
      metadata[CONTEXT_COMPACTION_METADATA_KEY],
    );
    return this.buildContextWindowSnapshotForMessages({
      checkpoint: existingCheckpoint,
      contextTokens: profile.contextTokens,
      reservedContextTokens: profile.reservedContextTokens,
      sessionId,
      sessionMessages,
    });
  };

  begin = (params: {
    contextWindowOwner: ContextWindowOwner;
    inputMessages: readonly NcpMessage[];
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
    storedMetadata: Record<string, unknown>;
  }): ContextCompactionBeginResult | null => {
    const {
      contextWindowOwner,
      inputMessages,
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
    } = params;
    if (contextWindowOwner === "runtime") {
      return null;
    }

    const metadata = structuredClone(storedMetadata);
    const profile = resolveCompactionProfile({
      config: this.options.getConfig(),
      requestMetadata,
      storedAgentId,
    });
    const { contextTokens, reservedContextTokens } = profile;
    const ncpMessages = mergeInputMessages({
      inputMessages,
      sessionMessages,
    });
    const modelCandidateMessages = ncpMessages.filter(
      (message) => !isContextCompactionTimelineMessage(message),
    );
    const existingCheckpoint = readCompressedContextCompactionCheckpoint(
      metadata[CONTEXT_COMPACTION_METADATA_KEY],
    );
    const projectedMessages = existingCheckpoint
      ? projectNcpMessagesWithContextCompaction({
          sessionId,
          sessionMessages: ncpMessages,
        })
      : modelCandidateMessages;
    const messages = toLegacyMessages(projectedMessages) as Record<string, unknown>[];
    const budget = this.contextWindowBudgetService.evaluate({
      messages,
      contextTokens,
      reservedContextTokens,
    });
    const plan = existingCheckpoint || !budget.shouldCompact
      ? null
      : this.compactionService.prepareForModelInput({
          messages: budget.messages,
          contextTokens,
          compactionThresholdTokens: budget.triggerTokens,
        });
    const checkpoint = plan
      ? {
          ...buildCompressingCompactionCheckpoint(
            metadata[CONTEXT_COMPACTION_METADATA_KEY],
          ),
          coveredMessageCount: plan.coveredMessages.length,
          coveredSessionMessageCount: plan.coveredMessages.length,
          originalEstimatedTokens: plan.originalEstimatedTokens,
          projectedEstimatedTokens: budget.estimatedTokens,
        }
      : existingCheckpoint;

    const contextWindow = buildContextWindowSnapshotFromBudget({
      budget,
      checkpoint,
      totalContextTokens: contextTokens,
    });
    if (plan && checkpoint) {
      metadata[CONTEXT_COMPACTION_METADATA_KEY] = checkpoint;
    }

    return {
      contextWindow,
      metadata,
      sessionMessages: ncpMessages,
      timelineMessage: plan && checkpoint
        ? buildContextCompactionTimelineNcpMessage({
            sessionId,
            checkpoint,
          })
        : null,
      pendingCompaction: plan && checkpoint
        ? {
            checkpoint,
            contextTokens,
            inputMessageIds: inputMessages.map((message) => message.id),
            model: profile.model,
            plan,
            reservedContextTokens,
            sessionId,
            sessionMessages: ncpMessages,
          }
        : null,
    };
  };

  private buildContextWindowSnapshotForMessages = (params: {
    checkpoint: ReturnType<typeof readCompressedContextCompactionCheckpoint>;
    contextTokens: number;
    reservedContextTokens: number;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
  }): ContextWindowSnapshot => {
    const { checkpoint, contextTokens, reservedContextTokens, sessionId, sessionMessages } = params;
    const modelCandidateMessages = sessionMessages.filter(
      (message) => !isContextCompactionTimelineMessage(message),
    );
    const projectedMessages = checkpoint
      ? projectNcpMessagesWithContextCompaction({
          sessionId,
          sessionMessages,
        })
      : modelCandidateMessages;
    const messages = toLegacyMessages(projectedMessages) as Record<string, unknown>[];
    const budget = this.contextWindowBudgetService.evaluate({
      messages,
      contextTokens,
      reservedContextTokens,
    });
    return buildContextWindowSnapshotFromBudget({
      budget,
      checkpoint,
      totalContextTokens: contextTokens,
    });
  };

  finish = async (
    pending: ContextCompactionPendingWork,
  ): Promise<ContextCompactionResult> => {
    const compacted = await this.compactionService.compactPreparedForModelInput({
      contextTokens: pending.contextTokens,
      plan: pending.plan,
      generateSummary: async ({ messages }) =>
        await this.generateSummary({
          messages,
          model: pending.model,
        }),
    });
    const generatedCheckpoint = compacted.checkpoint;
    if (!generatedCheckpoint) {
      throw new Error("context compaction pending work did not produce a checkpoint");
    }
    const checkpoint = {
      ...generatedCheckpoint,
      id: pending.checkpoint.id,
      createdAt: pending.checkpoint.createdAt,
      status: "compressed" as const,
    };
    const budget = this.contextWindowBudgetService.evaluate({
      messages: compacted.messages,
      contextTokens: pending.contextTokens,
      reservedContextTokens: pending.reservedContextTokens,
    });
    const contextWindow = buildContextWindowSnapshotFromBudget({
      budget,
      checkpoint,
      totalContextTokens: pending.contextTokens,
    });
    return {
      contextWindow,
      metadata: {
        [CONTEXT_COMPACTION_METADATA_KEY]: checkpoint,
      },
      sessionMessages: pending.sessionMessages,
      timelineMessage: buildContextCompactionTimelineNcpMessage({
        sessionId: pending.sessionId,
        checkpoint,
      }),
    };
  };

  private generateSummary = async (params: {
    messages: Record<string, unknown>[];
    model: string;
  }): Promise<string> => {
    if (!this.options.providerManager) {
      throw new Error("context compaction summary generation requires a provider manager");
    }
    const { messages, model } = params;
    const response = await this.options.providerManager.chat({
      model,
      maxTokens: SUMMARY_MAX_TOKENS,
      messages: [
        {
          role: "system",
          content: [
            "You are NextClaw's context compactor for a coding agent session.",
            "Create a dense, structured summary that will replace earlier conversation history in a future model request.",
            "Preserve user goals, explicit instructions, decisions, files touched or inspected, code changes, commands run, test results, failures, blockers, and exact next steps.",
            "Do not invent facts. If something is uncertain, mark it as uncertain.",
            "Return Markdown only. Start with '# Compressed Earlier Context'.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Compress these earlier runtime messages into a reusable checkpoint summary.",
            "",
            "Messages JSON:",
            stringifyCompactionSource(messages),
          ].join("\n"),
        },
      ],
    });
    const summary = response.content?.trim();
    if (!summary) {
      throw new Error("context compaction summary is empty");
    }
    return summary;
  };

  private publishLivePreflightResult = async function* (
    this: ContextCompactionManager,
    params: {
      input: NcpAgentRunInput;
      result: {
        contextWindow: ContextWindowSnapshot;
        sessionMessages: readonly NcpMessage[];
        timelineMessage: NcpMessage | null;
      };
      stateManager: RuntimeFactoryParams["stateManager"];
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const { input, result, stateManager } = params;
    const contextWindowEvent = createContextWindowUpdatedEvent({
      contextWindow: result.contextWindow,
      sessionId: input.sessionId,
    });
    await stateManager.dispatch(contextWindowEvent);
    yield contextWindowEvent;
    if (!result.timelineMessage) {
      return;
    }
    const activeRun = stateManager.getSnapshot().activeRun;
    stateManager.hydrate({
      sessionId: input.sessionId,
      messages: result.sessionMessages,
      activeRun,
      contextWindow: result.contextWindow,
    });
    const timelineEvent = {
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: input.sessionId,
        message: result.timelineMessage,
      },
    } as const;
    await stateManager.dispatch(timelineEvent);
    yield timelineEvent;
  };
}
