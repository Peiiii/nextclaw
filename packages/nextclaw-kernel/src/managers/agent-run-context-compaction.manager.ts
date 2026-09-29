import type { ContextCompactionPhase } from "@nextclaw/core/context-compaction";
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
};

export class AgentRunContextCompactionManager {
  private readonly preflightService: ContextCompactionPreflightService;

  constructor(
    agentManager: CompactionProfileResolver,
    providerManager: CompactionSummaryProvider,
    assetStore: LocalAssetStore | null = null,
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
    });
    if (!beginResult.pendingCompaction) {
      return;
    }
    const pending = beginResult.pendingCompaction;
    yield this.toEvent(input.sessionId, buildContextCompactionTimelineNcpMessage({
      checkpoint: pending.checkpoint,
      messageId: pending.serviceMessageId,
      sessionId: input.sessionId,
    }));
    try {
      const finishResult = await this.preflightService.finish(pending, input.signal);
      if (finishResult.timelineMessage) {
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
