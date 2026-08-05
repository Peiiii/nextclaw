import type { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import { createInboxDeliveryTools } from "@kernel/tools/inbox-delivery.tools.js";
import type {
  AgentRunRequest,
  ToolProvider,
} from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";

export class InboxDeliveryToolProvider implements ToolProvider {
  constructor(private readonly manager: InboxDeliveryManager) {}

  provide = (request: AgentRunRequest): readonly NcpTool[] =>
    createInboxDeliveryTools(this.manager, {
      agentId: request.agentId ?? null,
      sessionId: request.sessionId ?? null,
    });
}
