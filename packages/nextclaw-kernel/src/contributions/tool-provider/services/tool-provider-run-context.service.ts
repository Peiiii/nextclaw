import { buildNextclawNcpRunContext } from "@kernel/features/native-runtime/utils/nextclaw-ncp-run-context.utils.js";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import { buildAgentRunRequestMetadata } from "@kernel/utils/agent-run-request-metadata.utils.js";
import type { SessionProjectContextResolver } from "@nextclaw/core";

export type ToolProviderResolvedRunContext = Awaited<
  ReturnType<ToolProviderRunContextService["resolve"]>
>;

export class ToolProviderRunContextService {
  constructor(
    private readonly sessionManager: Pick<SessionManager, "getAgentRunSession">,
    private readonly agentManager: Pick<AgentManager, "resolveAgentProfileForRun">,
    private readonly configManager: Pick<ConfigManager, "loadConfig">,
    private readonly projectContextResolver: Pick<SessionProjectContextResolver, "resolve">,
  ) {}

  resolve = async (request: AgentRunRequest) => {
    const session = request.sessionId
      ? await this.sessionManager.getAgentRunSession(request.sessionId)
      : null;
    const sessionId = session?.sessionId ?? request.sessionId ?? request.message.sessionId ?? "";
    const requestMetadata = buildAgentRunRequestMetadata({ request, session });
    const runContext = buildNextclawNcpRunContext({
      agentProfile: this.agentManager.resolveAgentProfileForRun({
        requestMetadata,
        storedAgentId: request.agentId ?? session?.agentId,
      }),
      config: this.configManager.loadConfig(),
      sessionId,
      requestMetadata,
      sessionMetadata: session?.metadata ?? requestMetadata,
      projectContextResolver: this.projectContextResolver,
    });
    return {
      requestMetadata,
      runContext,
      session,
      sessionId,
      toolRunContext: runContext.toolRunContext,
    };
  };
}
