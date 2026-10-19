import type { ContextCompactionPhase, ContextCompactionCheckpoint } from "@nextclaw/core/context-compaction";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  buildContextCompactionTimelineNcpMessage,
} from "@kernel/features/context-compaction/utils/context-compaction.utils.js";
import {
  ContextCompactionPreflightService,
  type CompactionProfileResolver,
  type CompactionSummaryProvider,
  type ContextCompactionPreflightResult,
} from "@kernel/features/context-compaction/services/context-compaction-preflight.service.js";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpTool,
} from "@nextclaw/ncp";
import type { SessionManager } from "./session.manager.js";

export type AgentRunContextCompactionInput = {
  sessionId: string;
  agentId: string;
  contextBlocks: readonly string[];
  messages: readonly NcpMessage[];
  metadata: Record<string, unknown>;
  model: string;
  phase?: ContextCompactionPhase;
  signal?: AbortSignal;
  tools?: readonly NcpTool[];
  overflow?: boolean;
  maxOutputTokens?: number;
};

export class AgentRunContextCompactionManager {
  private readonly preflightService: ContextCompactionPreflightService;

  constructor(
    agentManager: CompactionProfileResolver,
    providerManager: CompactionSummaryProvider,
    assetStore: LocalAssetStore | null = null,
    private readonly sources?: Pick<SessionManager, "captureCompactionSource">,
  ) {
    this.preflightService = new ContextCompactionPreflightService(
      agentManager,
      providerManager,
      assetStore,
    );
  }

  runPreflight = (
    input: AgentRunContextCompactionInput,
  ): AsyncIterable<NcpEndpointEvent> => {
    return this.run(input, "automatic", input.phase ?? "pre-run");
  };

  runManual = async (
    input: AgentRunContextCompactionInput,
  ): Promise<readonly NcpEndpointEvent[]> => {
    const events: NcpEndpointEvent[] = [];
    for await (const event of this.run(input, "manual", "pre-run")) {
      events.push(event);
    }
    return events;
  };

  private run = async function* (
    this: AgentRunContextCompactionManager,
    input: AgentRunContextCompactionInput,
    trigger: "automatic" | "manual",
    phase: ContextCompactionPhase,
  ): AsyncIterable<NcpEndpointEvent> {
    input.signal?.throwIfAborted();
    const beginResult = this.preflightService.begin({
      contextBlocks: input.contextBlocks,
      inputMessages: [],
      model: input.model,
      phase,
      requestMetadata: input.metadata,
      sessionId: input.sessionId,
      sessionMessages: input.messages,
      storedAgentId: input.agentId,
      storedMetadata: input.metadata,
      tools: input.tools,
      trigger,
      overflow: input.overflow,
      maxOutputTokens: input.maxOutputTokens,
    });
    if (!beginResult.pendingCompaction) {
      return;
    }
    const pending = beginResult.pendingCompaction;
    const sourceIds = new Set(input.messages.map(message => message.id));
    const checkpointMessage = [...input.messages].reverse().find(message =>
      message.metadata?.nextclaw_timeline_kind === "context_compaction" && (message.metadata.checkpoint as { status?: string } | undefined)?.status === "compressed");
    const coveredIds = [...new Set(pending.plan.coveredMessages.flatMap(message => {
      const id = message.ncp_message_id;
      return typeof id === "string" ? sourceIds.has(id) ? [id] : checkpointMessage ? [checkpointMessage.id] : [] : [];
    }))];
    const source = this.sources ? await this.sources.captureCompactionSource(input.sessionId, coveredIds) : undefined;
    yield this.toEvent(input.sessionId, buildContextCompactionTimelineNcpMessage({
      checkpoint: pending.checkpoint,
      messageId: pending.serviceMessageId,
      sessionId: input.sessionId,
    }));
    try {
      const finishResult = await this.preflightService.finish(pending, input.signal);
      if (finishResult.timelineMessage) {
        const checkpoint = finishResult.timelineMessage.metadata?.checkpoint as ContextCompactionCheckpoint;
        if (source && checkpoint.status === "compressed") {
          checkpoint.version = 2;
          checkpoint.source = source;
          if (source.omittedRangeCount > 0) checkpoint.recovery = { required: true, reason: "unresolved-archive", archiveThrough: checkpoint.coveredUntil ?? checkpoint.updatedAt, checkpointId: checkpoint.recovery?.checkpointId ?? checkpoint.id };
        }
        input.signal?.throwIfAborted();
        yield this.toEvent(input.sessionId, finishResult.timelineMessage);
      }
    } catch (error) {
      yield this.toEvent(input.sessionId, buildContextCompactionTimelineNcpMessage({
        checkpoint: {
          ...pending.checkpoint,
          status: input.signal?.aborted ? "cancelled" : "failed",
          updatedAt: new Date().toISOString(),
        },
        messageId: pending.serviceMessageId,
        sessionId: input.sessionId,
      }));
      if (input.signal?.aborted) {
        return;
      }
      throw error;
    }
  };

  private toEvent = (
    sessionId: string,
    message: NonNullable<ContextCompactionPreflightResult["timelineMessage"]>,
  ): NcpEndpointEvent => ({
    occurredAt: new Date().toISOString(),
    type: NcpEventType.MessageSent,
    payload: {
      sessionId,
      message,
    },
  });
}
