import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import {
  buildAgentRunRequestMetadata,
  type AgentRunRequest,
  type ContextBlock,
  type ContextProvider,
} from "@kernel/features/agent-run/index.js";
import {
  buildSessionOrchestrationSection,
  resolveNextclawNcpRunContext,
} from "@kernel/features/native-runtime/index.js";
import {
  buildMinimalSystemExecutionPrompt,
  buildToolCatalogEntries,
  ContextBuilder,
  readSessionProjectRoot,
} from "@nextclaw/core";

export class KernelContextProvider implements ContextProvider {
  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly ContextBlock[]> => {
    const session = request.sessionId
      ? await this.branch.sessionRepository.getSession(request.sessionId)
      : null;
    const sessionId = session?.sessionId ?? request.sessionId ?? request.message.sessionId ?? "";
    const requestMetadata = buildAgentRunRequestMetadata({ request, session });
    const runContext = resolveNextclawNcpRunContext({
      configManager: this.kernel.configManager,
      sessionId,
      requestMetadata,
      sessionMetadata: session?.metadata ?? requestMetadata,
      storedAgentId: request.agentId ?? session?.agentId,
    });
    const toolRegistry = this.kernel.toolManager.createRuntimeRegistry({
      updateToolCallResult: async () => undefined,
    });
    toolRegistry.prepareForRun(runContext.toolRunContext);

    return [
      this.buildSystemContextBlock({
        availableTools: buildToolCatalogEntries(toolRegistry.getToolDefinitions()),
        runContext,
      }),
    ];
  };

  private buildSystemContextBlock = (params: {
    availableTools: ReturnType<typeof buildToolCatalogEntries>;
    runContext: ReturnType<typeof resolveNextclawNcpRunContext>;
  }): ContextBlock => {
    const { availableTools, runContext } = params;
    const contextBuilder = new ContextBuilder(
      runContext.effectiveWorkspace,
      runContext.config.agents.context,
      {
        hostWorkspace: runContext.profile.workspace,
        sessionProjectRoot: readSessionProjectRoot(runContext.sessionMetadata),
      },
    );
    const systemPrompt = contextBuilder.buildSystemPrompt(
      undefined,
      runContext.sessionKey,
      availableTools,
      [
        buildSessionOrchestrationSection(),
        buildMinimalSystemExecutionPrompt(runContext.effectiveModel),
      ],
    );

    const lines = [
      systemPrompt,
      "## Current Session",
      `Channel: ${runContext.channel}`,
      `Chat ID: ${runContext.chatId}`,
      `Session: ${runContext.sessionKey}`,
    ];
    if (runContext.runtimeThinking) {
      lines.push(`Thinking policy: ${runContext.runtimeThinking}`);
    }
    return lines.join("\n");
  };
}
