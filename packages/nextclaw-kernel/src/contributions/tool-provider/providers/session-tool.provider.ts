import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type {
  ToolProvider,
  ToolRegistrationContext,
  ToolRunContext,
} from "@kernel/managers/tool.manager.js";
import { SessionsHistoryTool, SessionsListTool } from "@kernel/tools/session-history.tools.js";
import { SessionRequestTool } from "@kernel/tools/session-request.tools.js";
import { SessionSearchTool } from "@kernel/tools/session-search.tools.js";
import { SessionSpawnTool } from "@kernel/tools/session-spawn.tools.js";

export class SessionToolProvider implements ToolProvider {
  readonly id = "nextclaw-session-tools";

  constructor(private readonly kernel: NextclawKernel) {}

  registerTools = (
    context: ToolRunContext,
    registry: ToolRegistrationContext,
  ): void => {
    const { handoffDepth, metadata, sessionId } = context;
    const sessionsSpawnTool = new SessionSpawnTool(
      this.kernel.ncpSessionManager,
      this.kernel.sessionRequests,
    );
    sessionsSpawnTool.setContext({
      sourceSessionId: sessionId,
      sourceSessionMetadata: metadata,
      handoffDepth,
    });
    registry.registerTool(sessionsSpawnTool);

    const sessionsRequestTool = new SessionRequestTool(this.kernel.sessionRequests);
    sessionsRequestTool.setContext({
      sourceSessionId: sessionId,
      handoffDepth,
    });
    registry.registerTool(sessionsRequestTool);

    registry.registerTool(new SessionsListTool(this.kernel.ncpSessionManager));
    registry.registerTool(new SessionsHistoryTool(this.kernel.ncpSessionManager));

    if (!this.kernel.sessionSearch.isReady()) {
      return;
    }
    registry.registerNcpTool(
      new SessionSearchTool(
        { search: this.kernel.sessionSearch.search },
        { currentSessionId: sessionId },
      ),
    );
  };
}
