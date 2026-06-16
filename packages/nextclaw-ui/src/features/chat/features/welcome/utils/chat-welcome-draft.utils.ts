import {
  normalizeSessionType,
  resolveAgentRuntimeSessionType,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import type { AgentProfileView } from "@/shared/lib/api";

type SessionTypeOptionLike = {
  value: string;
};

export function resolveChatWelcomeAgents(params: {
  agents: AgentProfileView[] | null | undefined;
  fallbackAgentId: string;
}): AgentProfileView[] {
  const { agents, fallbackAgentId } = params;
  return (agents?.length ?? 0) > 0 ? (agents ?? []) : [{ id: fallbackAgentId }];
}

export function resolveChatWelcomeDraftAgent(params: {
  agents: AgentProfileView[];
  agentId: string;
}): AgentProfileView | null {
  return params.agents.find((agent) => agent.id === params.agentId) ?? null;
}

export function resolveChatWelcomeDraftProjectRoot(params: {
  defaultProjectRoot: string | null;
  selectedProjectRoot: string | null;
}): string | null {
  return params.selectedProjectRoot ?? params.defaultProjectRoot;
}

function resolveAvailableSessionType(
  value: string | null | undefined,
  options: readonly SessionTypeOptionLike[],
): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const normalized = normalizeSessionType(value);
  return options.some((option) => option.value === normalized) ? normalized : null;
}

export function resolveChatWelcomeSelectedSessionType(params: {
  agents?: AgentProfileView[];
  agentId?: string;
  defaultSessionType: string;
  pendingSessionType: string | null | undefined;
  selectedSessionType: string | null | undefined;
  sessionTypeOptions: readonly SessionTypeOptionLike[];
}): string {
  const {
    agentId,
    agents,
    defaultSessionType,
    pendingSessionType,
    selectedSessionType,
    sessionTypeOptions,
  } = params;
  const explicitSessionType =
    resolveAvailableSessionType(selectedSessionType, sessionTypeOptions) ??
    resolveAvailableSessionType(pendingSessionType, sessionTypeOptions);
  if (explicitSessionType) {
    return explicitSessionType;
  }

  const agentSessionType =
    agents && agentId
      ? resolveAvailableSessionType(
          resolveAgentRuntimeSessionType(
            resolveChatWelcomeDraftAgent({
              agents,
              agentId,
            }),
            defaultSessionType,
          ),
          sessionTypeOptions,
        )
      : null;
  return (
    agentSessionType ??
    resolveAvailableSessionType(defaultSessionType, sessionTypeOptions) ??
    sessionTypeOptions[0]?.value ??
    normalizeSessionType(defaultSessionType)
  );
}
