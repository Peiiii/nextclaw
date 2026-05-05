import {
  findEffectiveAgentProfile,
  InputBudgetPruner,
  resolveDefaultAgentProfileId,
  type Config,
  type ProviderManager,
  type SessionManager,
} from "@nextclaw/core";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  normalizeString,
  toLegacyMessages,
} from "../nextclaw-ncp-message-bridge.js";
import { toNcpMessages } from "../session/nextclaw-agent-session-message-adapter.utils.js";
import {
  type ContextCompactionPlan,
  ContextCompactionService,
  readCompressedContextCompactionCheckpoint,
} from "./context-compaction.service.js";
import {
  buildContextCompactionTimelineNcpMessage,
  isContextCompactionTimelineMessage,
  upsertContextCompactionTimelineMessage,
} from "./context-compaction-timeline-message.utils.js";
import {
  buildContextWindowSnapshot,
  buildCompressingCompactionCheckpoint,
  CONTEXT_COMPACTION_METADATA_KEY,
  type ContextWindowSnapshot,
} from "./context-window-snapshot.utils.js";
import { projectNcpMessagesWithContextCompaction } from "./context-compaction-projection.utils.js";

export type ContextWindowOwner = "nextclaw" | "runtime";

export type ContextCompactionPreflightResult = {
  contextWindow: ContextWindowSnapshot;
  metadata: Record<string, unknown>;
  sessionMessages: NcpMessage[];
  timelineMessage: NcpMessage | null;
};

export type ContextCompactionPreflightBeginResult = ContextCompactionPreflightResult & {
  pendingCompaction: ContextCompactionPendingWork | null;
};

export type ContextCompactionPendingWork = {
  checkpoint: ReturnType<typeof buildCompressingCompactionCheckpoint>;
  contextTokens: number;
  inputMessageIds: string[];
  model: string;
  plan: ContextCompactionPlan;
  sessionId: string;
};

const DEFAULT_COMPACTION_TRIGGER_RATIO = 0.8;
const SUMMARY_MAX_TOKENS = 4000;
const SUMMARY_SOURCE_MAX_CHARS = 120_000;

type ResolvedCompactionProfile = {
  contextTokens: number;
  model: string;
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

export class ContextCompactionPreflightService {
  private readonly compactionService = new ContextCompactionService();
  private readonly inputBudgetPruner = new InputBudgetPruner();

  constructor(
    private readonly options: {
      getConfig: () => Config;
      providerManager?: ProviderManager;
      sessionManager: SessionManager;
    },
  ) {}

  run = async (params: {
    contextWindowOwner: ContextWindowOwner;
    inputMessages: readonly NcpMessage[];
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
  }): Promise<ContextCompactionPreflightResult | null> => {
    const beginResult = this.begin(params);
    if (!beginResult) {
      return null;
    }
    if (!beginResult.pendingCompaction) {
      return beginResult;
    }
    return await this.finish(beginResult.pendingCompaction);
  };

  preview = (params: {
    contextWindowOwner: ContextWindowOwner;
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
  }): ContextWindowSnapshot | null => {
    const {
      contextWindowOwner,
      requestMetadata,
      sessionId,
      sessionMessages,
    } = params;
    if (contextWindowOwner === "runtime") {
      return null;
    }
    const session = this.options.sessionManager.getIfExists(sessionId);
    const metadata = session?.metadata ?? requestMetadata;
    const profile = resolveCompactionProfile({
      config: this.options.getConfig(),
      requestMetadata,
      storedAgentId: session?.agentId,
    });
    const existingCheckpoint = readCompressedContextCompactionCheckpoint(
      metadata[CONTEXT_COMPACTION_METADATA_KEY],
    );
    return this.buildContextWindowSnapshotForMessages({
      checkpoint: existingCheckpoint,
      contextTokens: profile.contextTokens,
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
  }): ContextCompactionPreflightBeginResult | null => {
    const {
      contextWindowOwner,
      inputMessages,
      requestMetadata,
      sessionId,
      sessionMessages,
    } = params;
    if (contextWindowOwner === "runtime") {
      return null;
    }

    const session = this.options.sessionManager.getOrCreate(sessionId);
    const profile = resolveCompactionProfile({
      config: this.options.getConfig(),
      requestMetadata,
      storedAgentId: session.agentId,
    });
    const { contextTokens } = profile;
    const ncpMessages = mergeInputMessages({
      inputMessages,
      sessionMessages,
    });
    const modelCandidateMessages = ncpMessages.filter(
      (message) => !isContextCompactionTimelineMessage(message),
    );
    const existingCheckpoint = readCompressedContextCompactionCheckpoint(
      session.metadata[CONTEXT_COMPACTION_METADATA_KEY],
    );
    const projectedMessages = existingCheckpoint
      ? projectNcpMessagesWithContextCompaction({
          sessionId,
          sessionMessages: ncpMessages,
        })
      : modelCandidateMessages;
    const messages = toLegacyMessages(projectedMessages) as Record<string, unknown>[];
    const plan = existingCheckpoint
      ? null
      : this.compactionService.prepareForModelInput({
          messages,
          contextTokens,
          compactionThresholdTokens: Math.floor(contextTokens * DEFAULT_COMPACTION_TRIGGER_RATIO),
        });
    const pruned = this.inputBudgetPruner.prune({
      messages,
      contextTokens,
    });
    const checkpoint = plan
      ? {
          ...buildCompressingCompactionCheckpoint(
            session.metadata[CONTEXT_COMPACTION_METADATA_KEY],
          ),
          coveredMessageCount: plan.coveredMessages.length,
          coveredSessionMessageCount: plan.coveredMessages.length,
          originalEstimatedTokens: plan.originalEstimatedTokens,
          projectedEstimatedTokens: pruned.estimatedTokens,
        }
      : existingCheckpoint;

    const contextWindow = buildContextWindowSnapshot({
      usedContextTokens: pruned.estimatedTokens,
      totalContextTokens: contextTokens,
      prunedUsedContextTokens: pruned.estimatedTokens,
      droppedHistoryCount: pruned.droppedHistoryCount,
      truncatedToolResultCount: pruned.truncatedToolResultCount,
      truncatedSystemPrompt: pruned.truncatedSystemPrompt,
      truncatedUserMessage: pruned.truncatedUserMessage,
      checkpoint,
      compactedUsedContextTokens: checkpoint ? pruned.estimatedTokens : undefined,
    });
    if (plan && checkpoint) {
      session.metadata[CONTEXT_COMPACTION_METADATA_KEY] = checkpoint;
      upsertContextCompactionTimelineMessage({
        session,
        checkpoint,
        insertBeforeMessageIds: inputMessages.map((message) => message.id),
      });
    }

    this.options.sessionManager.save(session);
    return {
      contextWindow,
      metadata: structuredClone(session.metadata),
      sessionMessages: toNcpMessages(sessionId, session.messages),
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
            sessionId,
          }
        : null,
    };
  };

  private buildContextWindowSnapshotForMessages = (params: {
    checkpoint: ReturnType<typeof readCompressedContextCompactionCheckpoint>;
    contextTokens: number;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
  }): ContextWindowSnapshot => {
    const { checkpoint, contextTokens, sessionId, sessionMessages } = params;
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
    const pruned = this.inputBudgetPruner.prune({
      messages,
      contextTokens,
    });
    return buildContextWindowSnapshot({
      usedContextTokens: pruned.estimatedTokens,
      totalContextTokens: contextTokens,
      prunedUsedContextTokens: pruned.estimatedTokens,
      droppedHistoryCount: pruned.droppedHistoryCount,
      truncatedToolResultCount: pruned.truncatedToolResultCount,
      truncatedSystemPrompt: pruned.truncatedSystemPrompt,
      truncatedUserMessage: pruned.truncatedUserMessage,
      checkpoint,
      compactedUsedContextTokens: checkpoint ? pruned.estimatedTokens : undefined,
    });
  };

  finish = async (
    pending: ContextCompactionPendingWork,
  ): Promise<ContextCompactionPreflightResult> => {
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
    const pruned = this.inputBudgetPruner.prune({
      messages: compacted.messages,
      contextTokens: pending.contextTokens,
    });
    const contextWindow = buildContextWindowSnapshot({
      usedContextTokens: pruned.estimatedTokens,
      totalContextTokens: pending.contextTokens,
      prunedUsedContextTokens: pruned.estimatedTokens,
      droppedHistoryCount: pruned.droppedHistoryCount,
      truncatedToolResultCount: pruned.truncatedToolResultCount,
      truncatedSystemPrompt: pruned.truncatedSystemPrompt,
      truncatedUserMessage: pruned.truncatedUserMessage,
      checkpoint,
      compactedUsedContextTokens: pruned.estimatedTokens,
    });
    const session = this.options.sessionManager.getOrCreate(pending.sessionId);
    session.metadata[CONTEXT_COMPACTION_METADATA_KEY] = checkpoint;
    upsertContextCompactionTimelineMessage({
      session,
      checkpoint,
      insertBeforeMessageIds: pending.inputMessageIds,
    });
    this.options.sessionManager.save(session);
    return {
      contextWindow,
      metadata: structuredClone(session.metadata),
      sessionMessages: toNcpMessages(pending.sessionId, session.messages),
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
}
