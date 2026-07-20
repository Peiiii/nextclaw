import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
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
  contextBlocks: readonly string[];
  messages: readonly NcpMessage[];
  metadata: Record<string, unknown>;
  model: string;
};

export class AgentRunContextCompactionManager {
  private readonly preflightService: ContextCompactionPreflightService;

  constructor(
    agentManager: AgentManager,
    providerManager: LlmProviderRuntime,
    private readonly sessionManager: SessionManager,
  ) {
    this.preflightService = new ContextCompactionPreflightService(agentManager, providerManager);
  }

  runPreflight = async (
    input: AgentRunContextCompactionInput,
  ): Promise<readonly NcpEndpointEvent[]> => {
    return await this.run(input, "automatic");
  };

  runManual = async (
    input: AgentRunContextCompactionInput,
  ): Promise<readonly NcpEndpointEvent[]> => {
    return await this.run(input, "manual");
  };

  private run = async (
    input: AgentRunContextCompactionInput,
    trigger: "automatic" | "manual",
  ): Promise<readonly NcpEndpointEvent[]> => {
    const beginResult = this.preflightService.begin({
      contextBlocks: input.contextBlocks,
      inputMessages: [],
      model: input.model,
      requestMetadata: input.metadata,
      sessionId: input.sessionId,
      sessionMessages: input.messages,
      storedAgentId: input.agentId,
      storedMetadata: input.metadata,
      trigger,
    });
    if (!beginResult.pendingCompaction) {
      return [];
    }
    const finishResult = await this.preflightService.finish(beginResult.pendingCompaction);
    return await this.toEvents(input.sessionId, finishResult);
  };

  private toEvents = async (
    sessionId: string,
    result: ContextCompactionPreflightResult,
  ): Promise<NcpEndpointEvent[]> => {
    if (Object.keys(result.metadataPatch).length > 0) {
      await this.sessionManager.patchSessionMetadata(sessionId, result.metadataPatch);
    }
    if (!result.timelineMessage) {
      return [];
    }
    return [
      {
        occurredAt: new Date().toISOString(),
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: result.timelineMessage,
        },
      },
    ];
  };
}
