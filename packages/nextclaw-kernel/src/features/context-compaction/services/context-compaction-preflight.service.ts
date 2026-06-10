import {
  CONTEXT_COMPACTION_METADATA_KEY,
  ContextCompactionService,
  ContextWindowBudgetService,
  buildCompressingCompactionCheckpoint,
  buildContextWindowSnapshot,
  readCompressedContextCompactionCheckpoint,
  type ContextCompactionCheckpoint,
  type ContextCompactionPlan,
  type ContextWindowBudgetEvaluation,
  type ContextWindowSnapshot,
} from "@nextclaw/core";
import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import { toLegacyMessages } from "@kernel/utils/ncp-message-bridge.utils.js";
import {
  buildContextCompactionModelInput,
  buildContextCompactionTimelineNcpMessage,
  createContextCompactionMessageId,
  isContextCompactionTimelineMessage,
  readLatestContextCompactionCheckpoint,
} from "@kernel/features/context-compaction/utils/context-compaction.utils.js";

export type ContextCompactionPreflightResult = {
  contextWindow: ContextWindowSnapshot;
  metadataPatch: Record<string, unknown>;
  sessionMessages: NcpMessage[];
  timelineMessage: NcpMessage | null;
};

export type ContextCompactionPreflightBeginResult = ContextCompactionPreflightResult & {
  pendingCompaction: ContextCompactionPendingWork | null;
};

type ContextCompactionPendingWork = {
  checkpoint: ReturnType<typeof buildCompressingCompactionCheckpoint>;
  contextTokens: number;
  serviceMessageId: string;
  model: string;
  plan: ContextCompactionPlan;
  reservedContextTokens: number;
  sessionId: string;
  sessionMessages: NcpMessage[];
};

type ResolvedCompactionProfile = {
  contextTokens: number;
  model: string;
  reservedContextTokens: number;
};

const SUMMARY_MAX_TOKENS = 4000;
const SUMMARY_SOURCE_MAX_CHARS = 120_000;

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

export class ContextCompactionPreflightService {
  private readonly compactionService = new ContextCompactionService();
  private readonly contextWindowBudgetService = new ContextWindowBudgetService();

  constructor(
    private readonly agentManager: AgentManager,
    private readonly providerManager?: LlmProviderRuntime,
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
    const profile = this.resolveCompactionProfile({
      requestMetadata,
      storedAgentId,
    });
    const existingCheckpoint = readCompressedContextCompactionCheckpoint(
      storedMetadata[CONTEXT_COMPACTION_METADATA_KEY],
    ) ?? readLatestContextCompactionCheckpoint(sessionMessages);
    const projectedMessages = existingCheckpoint
      ? buildContextCompactionModelInput({
          sessionId,
          sessionMessages,
        })
      : sessionMessages.filter((message) => !isContextCompactionTimelineMessage(message));
    const budget = this.contextWindowBudgetService.evaluate({
      messages: toLegacyMessages(projectedMessages) as Record<string, unknown>[],
      contextTokens: profile.contextTokens,
      reservedContextTokens: profile.reservedContextTokens,
    });
    return buildContextWindowSnapshotFromBudget({
      budget,
      checkpoint: existingCheckpoint,
      totalContextTokens: profile.contextTokens,
    });
  };

  begin = (params: {
    inputMessages: readonly NcpMessage[];
    requestMetadata: Record<string, unknown>;
    sessionId: string;
    sessionMessages: readonly NcpMessage[];
    storedAgentId?: string;
    storedMetadata: Record<string, unknown>;
  }): ContextCompactionPreflightBeginResult => {
    const {
      inputMessages,
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
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
    const existingCheckpoint = readCompressedContextCompactionCheckpoint(
      storedMetadata[CONTEXT_COMPACTION_METADATA_KEY],
    ) ?? readLatestContextCompactionCheckpoint(ncpMessages);
    const projectedMessages = existingCheckpoint
      ? buildContextCompactionModelInput({
          sessionId,
          sessionMessages: ncpMessages,
        })
      : ncpMessages.filter((message) => !isContextCompactionTimelineMessage(message));
    const messages = toLegacyMessages(projectedMessages) as Record<string, unknown>[];
    const budget = this.contextWindowBudgetService.evaluate({
      messages,
      contextTokens,
      reservedContextTokens,
    });
    const plan = !budget.shouldCompact
      ? null
      : this.compactionService.prepareForModelInput({
          messages,
          contextTokens,
          compactionThresholdTokens: budget.triggerTokens,
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
          coveredMessageCount: coveredSessionMessageCount,
          coveredSessionMessageCount,
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
            messageId: serviceMessageId,
            sessionId,
            checkpoint,
          })
        : null,
      pendingCompaction: plan && checkpoint
        ? {
            checkpoint,
            contextTokens,
            serviceMessageId,
            model: profile.model,
            plan,
            reservedContextTokens,
            sessionId,
            sessionMessages: ncpMessages,
          }
        : null,
    };
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
      coveredMessageCount: pending.checkpoint.coveredMessageCount,
      coveredSessionMessageCount: pending.checkpoint.coveredSessionMessageCount,
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
        messageId: pending.serviceMessageId,
        sessionId: pending.sessionId,
        checkpoint,
      }),
    };
  };

  private generateSummary = async (params: {
    messages: Record<string, unknown>[];
    model: string;
  }): Promise<string> => {
    if (!this.providerManager) {
      throw new Error("context compaction summary generation requires a provider manager");
    }
    const { messages, model } = params;
    const response = await this.providerManager.chat({
      model,
      maxTokens: SUMMARY_MAX_TOKENS,
      messages: [
        {
          role: "system",
          content: [
            "You are NextClaw's context compactor for a coding agent session.",
            "Create a complete compressed working context that will replace all prior conversation messages in a future model request.",
            "The model will not receive a raw recent-message tail, so preserve the latest user intent and recent turns with high fidelity inside the summary.",
            "Preserve user goals, explicit instructions, decisions, files touched or inspected, code changes, commands run, test results, failures, blockers, current task state, and exact next steps.",
            "Do not invent facts. If something is uncertain, mark it as uncertain.",
            "Return Markdown only. Start with '# Compressed Working Context'.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Compress these runtime messages into a reusable working context.",
            "Include a 'Recent High-Fidelity Context' section for the latest important user/assistant turns.",
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
      model: profile.model,
      reservedContextTokens: profile.reservedContextTokens,
    };
  };
}
