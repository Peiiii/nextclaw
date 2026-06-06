import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import { buildAgentRunRequestMetadata } from "@kernel/utils/agent-run-request-metadata.utils.js";
import {
  resolveNextclawNcpRunContext,
  type NextclawNcpResolvedRunContext,
} from "@kernel/features/native-runtime/index.js";
import {
  buildToolCatalogEntries,
  readSessionProjectRoot,
  SessionProjectContextResolver,
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

export class ContextProviderRunContextService {
  private readonly snapshots = new WeakMap<
    AgentRunRequest,
    Promise<ContextProviderRunContextSnapshot>
  >();
  private readonly projectContextResolver = new SessionProjectContextResolver();

  constructor(private readonly kernel: NextclawKernel) {}

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
    const runContext = resolveNextclawNcpRunContext({
      configManager: this.kernel.configManager,
      sessionId,
      requestMetadata,
      sessionMetadata: session?.metadata ?? requestMetadata,
      storedAgentId: request.agentId ?? session?.agentId,
    });
    const tools = await this.kernel.toolProviderManager.buildTools(request);
    const sessionProjectRoot = readSessionProjectRoot(
      runContext.sessionMetadata,
    );
    const projectContext = this.projectContextResolver.resolve({
      sessionMetadata: sessionProjectRoot
        ? { project_root: sessionProjectRoot }
        : null,
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
