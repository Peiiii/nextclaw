import type { ObservationManager } from "@kernel/features/observation/index.js";
import { createObservationTools } from "@kernel/tools/observation.tools.js";
import type {
  AgentRunRequest,
  ToolProvider,
} from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";

export class ObservationToolProvider implements ToolProvider {
  constructor(private readonly manager: ObservationManager) {}

  provide = (request: AgentRunRequest): readonly NcpTool[] =>
    createObservationTools(this.manager, {
      sessionId: request.sessionId ?? request.message.sessionId,
    });
}
