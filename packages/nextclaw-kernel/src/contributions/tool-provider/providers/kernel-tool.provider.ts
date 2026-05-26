import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import {
  buildAgentRunRequestMetadata,
  type AgentRunRequest,
  type ToolProvider,
} from "@kernel/features/agent-run/index.js";
import { resolveNextclawNcpRunContext } from "@kernel/features/native-runtime/index.js";
import {
  eventKeys,
} from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpTool,
} from "@nextclaw/ncp";

export class KernelToolProvider implements ToolProvider {
  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
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
      updateToolCallResult: async ({ result, sessionId: targetSessionId, toolCallId }) => {
        this.kernel.eventBus.emit(eventKeys.ncpEvent, {
          type: NcpEventType.MessageToolCallResult,
          payload: {
            sessionId: targetSessionId,
            toolCallId,
            content: result,
          },
        }, {
          emittedAt: new Date().toISOString(),
          source: "agent-run-tool-provider",
        });
      },
    });
    toolRegistry.prepareForRun(runContext.toolRunContext);
    return toolRegistry.listTools();
  };
}
