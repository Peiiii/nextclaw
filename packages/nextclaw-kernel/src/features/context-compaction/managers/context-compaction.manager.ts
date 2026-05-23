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
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import {
  type NcpAgentRunInput,
  type NcpEndpointEvent,
  type NcpMessage,
  NcpEventType,
} from "@nextclaw/ncp";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import type { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import type { LiveSession } from "@kernel/utils/session-run.utils.js";
import {
  normalizeString,
  toLegacyMessages,
} from "@kernel/utils/ncp-message-bridge.utils.js";
import {
  buildContextCompactionTimelineNcpMessage,
  isContextCompactionTimelineMessage,
} from "@kernel/features/context-compaction/utils/context-compaction-timeline-message.utils.js";
import { projectNcpMessagesWithContextCompaction } from "@kernel/features/context-compaction/utils/context-compaction-projection.utils.js";

type ContextCompactionResult = {
  contextWindow: ContextWindowSnapshot;
  metadataPatch: Record<string, unknown>;
  sessionMessages: NcpMessage[];
  timelineMessage: NcpMessage | null;
};

type ContextCompactionBeginResult = ContextCompactionResult & {
  pendingCompaction: ContextCompactionPendingWork | null;
};

type ContextCompactionPendingWork = {
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

function buildContextWindowSnapshotForMessages(
  contextWindowBudgetService: ContextWindowBudgetService,
  params: {
    checkpoint: ReturnType<typeof readCompressedContextCompactionCheckpoint>;
    contextTokens: number;
    reservedContextTokens: number;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
  },
): ContextWindowSnapshot {
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
  const budget = contextWindowBudgetService.evaluate({
    messages,
    contextTokens,
    reservedContextTokens,
  });
  return buildContextWindowSnapshotFromBudget({
    budget,
    checkpoint,
    totalContextTokens: contextTokens,
  });
}

export class ContextWindowPreviewManager {
  private readonly contextWindowBudgetService = new ContextWindowBudgetService();

  constructor(
    private readonly options: {
      configManager: ConfigManager;
    },
  ) {}

  preview = (params: {
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
    storedMetadata: Record<string, unknown>;
  }): ContextWindowSnapshot | null => {
    const {
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
    } = params;
    const metadata = storedMetadata;
    const profile = resolveCompactionProfile({
      config: this.options.configManager.loadConfig(),
      requestMetadata,
      storedAgentId,
    });
    const existingCheckpoint = readCompressedContextCompactionCheckpoint(
      metadata[CONTEXT_COMPACTION_METADATA_KEY],
    );
    return buildContextWindowSnapshotForMessages(this.contextWindowBudgetService, {
      checkpoint: existingCheckpoint,
      contextTokens: profile.contextTokens,
      reservedContextTokens: profile.reservedContextTokens,
      sessionId,
      sessionMessages,
    });
  };
}

export class ContextCompactionManager {
  private readonly compactionService = new ContextCompactionService();
  private readonly contextWindowBudgetService = new ContextWindowBudgetService();

  constructor(
    private readonly options: {
      configManager: ConfigManager;
      providerManager?: LlmProviderRuntime;
      sessionRunManager: SessionRunManager;
    },
  ) {}

  runLivePreflight = async function* (
    this: ContextCompactionManager,
    params: {
      input: NcpAgentRunInput;
      session: LiveSession;
    },
  ): AsyncIterable<NcpEndpointEvent> {
    const sessionRunManager = this.options.sessionRunManager;
    const { input, session } = params;
    const beginResult = this.begin({
      inputMessages: input.messages,
      requestMetadata: input.metadata ?? {},
      sessionId: input.sessionId,
      sessionMessages: session.stateManager.getSnapshot().messages,
      ...(session.agentId ? { storedAgentId: session.agentId } : {}),
      storedMetadata: session.metadata,
    });
    yield* this.applyLivePreflightResult({ input, result: beginResult, session, sessionRunManager });
    if (!beginResult.pendingCompaction) {
      return;
    }
    const finishResult = await this.finish(beginResult.pendingCompaction);
    yield* this.applyLivePreflightResult({ input, result: finishResult, session, sessionRunManager });
  };

  private begin = (params: {
    inputMessages: readonly NcpMessage[];
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
    storedMetadata: Record<string, unknown>;
  }): ContextCompactionBeginResult => {
    const {
      inputMessages,
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
    } = params;
    const profile = resolveCompactionProfile({
      config: this.options.configManager.loadConfig(),
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
      storedMetadata[CONTEXT_COMPACTION_METADATA_KEY],
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
            storedMetadata[CONTEXT_COMPACTION_METADATA_KEY],
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
    return {
      contextWindow,
      metadataPatch: plan && checkpoint
        ? { [CONTEXT_COMPACTION_METADATA_KEY]: checkpoint }
        : {},
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

  private finish = async (
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
      metadataPatch: {
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

  private applyLivePreflightResult = async function* (
    this: ContextCompactionManager,
    params: {
      input: NcpAgentRunInput;
      result: ContextCompactionResult;
      session: LiveSession;
      sessionRunManager: SessionRunManager;
    },
  ): AsyncIterable<NcpEndpointEvent> {
    const { input, result, session, sessionRunManager } = params;
    if (Object.keys(result.metadataPatch).length > 0) {
      await sessionRunManager.updateSessionMetadata(session.sessionId, result.metadataPatch);
    }
    const contextWindowEvent = {
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        sessionId: input.sessionId,
        contextWindow: result.contextWindow,
      },
    } as const;
    await sessionRunManager.appendSessionEvent(session.sessionId, contextWindowEvent);
    yield contextWindowEvent;
    if (!result.timelineMessage) {
      return;
    }
    const activeRun = session.stateManager.getSnapshot().activeRun;
    session.stateManager.hydrate({
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
    await sessionRunManager.appendSessionEvent(session.sessionId, timelineEvent);
    yield timelineEvent;
  };
}
