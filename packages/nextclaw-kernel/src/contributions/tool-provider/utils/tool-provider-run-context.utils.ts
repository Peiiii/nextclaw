import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import {
  buildAgentRunRequestMetadata,
  type AgentRunRequest,
} from "@kernel/features/agent-run/index.js";
import { resolveNextclawNcpRunContext } from "@kernel/features/native-runtime/index.js";

export type ToolProviderResolvedRunContext = Awaited<
  ReturnType<typeof resolveToolProviderRunContext>
>;

export async function resolveToolProviderRunContext(params: {
  branch: KernelBranch;
  kernel: NextclawKernel;
  request: AgentRunRequest;
}) {
  const { branch, kernel, request } = params;
  const session = request.sessionId
    ? await branch.sessionRepository.getSession(request.sessionId)
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
