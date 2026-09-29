import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { ToolProviderManager } from "@kernel/managers/tool-provider.manager.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import { buildAgentRunRequestMetadata } from "@kernel/utils/agent-run-request-metadata.utils.js";
import {
  buildNextclawNcpRunContext,
  type NextclawNcpResolvedRunContext,
} from "@kernel/features/native-runtime/utils/nextclaw-ncp-run-context.utils.js";
import {
  buildToolCatalogEntries,
  type SessionProjectContextResolver,
  type SessionProjectContext,
  type ToolCatalogEntry,
} from "@nextclaw/core";
import { mergeNativeContextConfig } from "@kernel/contributions/context-provider/utils/native-context-config.utils.js";

export type ContextProviderRunContextSnapshot = {
  contextConfig: NextclawNcpResolvedRunContext["config"]["agents"]["context"];
  projectContext: SessionProjectContext;
  runContext: NextclawNcpResolvedRunContext;
  toolCatalog: ToolCatalogEntry[];
};

type ContextProviderOwners = {
  agents: Pick<AgentManager, "resolveAgentProfileForRun">;
  configManager: Pick<ConfigManager, "loadConfig">;
  sessionManager: Pick<SessionManager, "getAgentRunSession">;
  toolProviderManager: Pick<ToolProviderManager, "buildTools">;
};

export class ContextProviderRunContextService {
  private readonly snapshots = new WeakMap<
    AgentRunRequest,
    Promise<ContextProviderRunContextSnapshot>
  >();
  constructor(
    private readonly kernel: ContextProviderOwners,
    private readonly projectContextResolver: Pick<SessionProjectContextResolver, "resolve">,
  ) {}

  resolve = (
    request: AgentRunRequest,
  ): Promise<ContextProviderRunContextSnapshot> => {
    const existing = this.snapshots.get(request);
    if (existing) {
      return existing;
    }

    const next = this.resolveSnapshot(request);
    this.snapshots.set(request, next);
    return next;
  };

  private resolveSnapshot = async (
    request: AgentRunRequest,
  ): Promise<ContextProviderRunContextSnapshot> => {
    const session = request.sessionId
      ? await this.kernel.sessionManager.getAgentRunSession(request.sessionId)
      : null;
    const sessionId =
      session?.sessionId ??
      request.sessionId ??
      request.message.sessionId ??
      "";
    const requestMetadata = buildAgentRunRequestMetadata({ request, session });
    const runContext = buildNextclawNcpRunContext({
      agentProfile: this.kernel.agents.resolveAgentProfileForRun({
        requestMetadata,
        storedAgentId: request.agentId ?? session?.agentId,
      }),
      config: this.kernel.configManager.loadConfig(),
      sessionId,
      requestMetadata,
      sessionMetadata: session?.metadata ?? requestMetadata,
      projectContextResolver: this.projectContextResolver,
    });
    const tools = await this.kernel.toolProviderManager.buildTools(request);
    const projectContext = this.projectContextResolver.resolve({
      sessionMetadata: runContext.sessionMetadata,
      workspace: runContext.profile.workspace,
      defaultWorkspace: runContext.effectiveWorkspace,
    });

    return {
      contextConfig: mergeNativeContextConfig(runContext.config.agents.context),
      projectContext,
      runContext,
      toolCatalog: buildToolCatalogEntries(
        tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      ),
    };
  };
}
