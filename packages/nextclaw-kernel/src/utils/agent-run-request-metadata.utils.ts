import type { AgentRunSession } from "@kernel/repositories/session.repository.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";

function normalizeString(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function buildAgentRunRequestMetadata(params: {
  request: AgentRunRequest;
  session?: AgentRunSession | null;
}): Record<string, unknown> {
  const { request, session } = params;
  const agentId = normalizeString(request.agentId ?? session?.agentId);
  const projectRoot = normalizeString(request.projectRoot ?? session?.projectRoot);
  const channel = normalizeString(request.channel);
  const model = normalizeString(request.model ?? session?.model);

  return {
    ...structuredClone(session?.metadata ?? {}),
    agentId,
    projectRoot,
    project_root: projectRoot,
    channel,
    model,
    thinkingEffort: request.thinkingEffort ?? session?.thinkingEffort,
  };
}
