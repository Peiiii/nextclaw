import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import { buildAgentRunRequestMetadata } from "@kernel/utils/agent-run-request-metadata.utils.js";
import { resolveNextclawNcpRunContext } from "@kernel/features/native-runtime/index.js";

export type ToolProviderResolvedRunContext = Awaited<
  ReturnType<typeof resolveToolProviderRunContext>
>;

export async function resolveToolProviderRunContext(params: {
  kernel: NextclawKernel;
  request: AgentRunRequest;
}) {
  const { kernel, request } = params;
  const session = request.sessionId
    ? await kernel.sessionManager.getAgentRunSession(request.sessionId)
    : null;
  const sessionId = session?.sessionId ?? request.sessionId ?? request.message.sessionId ?? "";
  const requestMetadata = buildAgentRunRequestMetadata({ request, session });
  const runContext = resolveNextclawNcpRunContext({
    configManager: kernel.configManager,
    sessionId,
    requestMetadata,
    sessionMetadata: session?.metadata ?? requestMetadata,
    storedAgentId: request.agentId ?? session?.agentId,
  });
  return {
    requestMetadata,
    runContext,
    session,
    sessionId,
    toolRunContext: runContext.toolRunContext,
  };
}
