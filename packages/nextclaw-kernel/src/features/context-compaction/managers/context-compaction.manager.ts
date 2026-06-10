import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { ContextWindowSnapshot } from "@nextclaw/core";
import { type NcpMessage } from "@nextclaw/ncp";
import { ContextCompactionPreflightService } from "@kernel/features/context-compaction/services/context-compaction-preflight.service.js";

export class ContextWindowPreviewManager {
  private readonly preflightService: ContextCompactionPreflightService;

  constructor(agentManager: AgentManager) {
    this.preflightService = new ContextCompactionPreflightService(agentManager);
  }

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
    return this.preflightService.preview({
      requestMetadata,
      sessionId,
      sessionMessages,
      storedAgentId,
      storedMetadata,
    });
  };
}
