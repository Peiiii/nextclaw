import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import { buildAgentRunRequestMetadata } from "@kernel/utils/agent-run-request-metadata.utils.js";
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
  constructor(private readonly kernel: NextclawKernel) {}

  provide = async (request: AgentRunRequest): Promise<readonly ContextBlock[]> => {
    const session = request.sessionId
      ? await this.kernel.sessionRepository.getSession(request.sessionId)
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
    const tools = await this.kernel.toolProviderManager.buildTools(request);

    return [
      this.buildSystemContextBlock({
        availableTools: buildToolCatalogEntries(
          tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
        ),
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
