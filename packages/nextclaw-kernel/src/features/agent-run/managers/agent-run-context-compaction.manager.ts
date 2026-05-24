import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import type { SessionRepository } from "@kernel/features/agent-run/repositories/session.repository.js";
import {
  ContextCompactionPreflightService,
  type ContextCompactionPreflightResult,
} from "@kernel/features/context-compaction/index.js";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";

export type AgentRunContextCompactionInput = {
  sessionId: string;
  agentId: string;
  messages: readonly NcpMessage[];
  metadata: Record<string, unknown>;
};

export class AgentRunContextCompactionManager {
  private readonly preflightService: ContextCompactionPreflightService;

  constructor(
    configManager: ConfigManager,
    providerManager: LlmProviderRuntime,
    private readonly sessionRepository: SessionRepository,
  ) {
    this.preflightService = new ContextCompactionPreflightService({
      configManager,
      providerManager,
    });
  }

  runPreflight = async (
    input: AgentRunContextCompactionInput,
  ): Promise<readonly NcpEndpointEvent[]> => {
    const beginResult = this.preflightService.begin({
      inputMessages: [],
      requestMetadata: input.metadata,
      sessionId: input.sessionId,
      sessionMessages: input.messages,
      storedAgentId: input.agentId,
      storedMetadata: input.metadata,
    });
    const events = await this.toEvents(input.sessionId, beginResult);
    if (!beginResult.pendingCompaction) {
      return events;
    }
    const finishResult = await this.preflightService.finish(beginResult.pendingCompaction);
    return [
      ...events,
      ...(await this.toEvents(input.sessionId, finishResult)),
    ];
  };

  private toEvents = async (
    sessionId: string,
    result: ContextCompactionPreflightResult,
  ): Promise<NcpEndpointEvent[]> => {
    if (Object.keys(result.metadataPatch).length > 0) {
      await this.sessionRepository.patchSessionMetadata(sessionId, result.metadataPatch);
    }
    if (!result.timelineMessage) {
      return [];
    }
    return [
      {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: result.timelineMessage,
        },
      },
    ];
  };
}
