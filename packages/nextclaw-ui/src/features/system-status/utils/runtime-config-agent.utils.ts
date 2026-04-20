import type { AgentBindingView, AgentProfileView } from '@/api/types';

export function createEmptyRuntimeAgent(): AgentProfileView {
  return { id: '', default: false, workspace: '', model: '', runtime: '', contextTokens: undefined, maxToolIterations: undefined };
}

export function createEmptyRuntimeBinding(): AgentBindingView {
  return { agentId: '', match: { channel: '', accountId: '' } };
}

export function hydrateRuntimeAgent(agent: AgentProfileView): AgentProfileView {
  return { id: agent.id ?? '', default: Boolean(agent.default), displayName: agent.displayName ?? '', description: agent.description ?? '', avatar: agent.avatar ?? '', workspace: agent.workspace ?? '', model: agent.model ?? '', runtime: agent.runtime ?? agent.engine ?? '', contextTokens: agent.contextTokens, maxToolIterations: agent.maxToolIterations };
}

export function hydrateRuntimeBinding(binding: AgentBindingView): AgentBindingView {
  return {
    agentId: binding.agentId ?? '',
    match: {
      channel: binding.match?.channel ?? '',
      accountId: binding.match?.accountId ?? '',
      peer: binding.match?.peer ? { kind: binding.match.peer.kind, id: binding.match.peer.id } : undefined
    }
  };
}

export function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toPersistedRuntimeAgent(agent: AgentProfileView): AgentProfileView {
  const normalized: AgentProfileView = { id: agent.id.trim() };
  if (agent.default) {
    normalized.default = true;
  }
  if (agent.displayName?.trim()) {
    normalized.displayName = agent.displayName.trim();
  }
  if (agent.description?.trim()) {
    normalized.description = agent.description.trim();
  }
  if (agent.avatar?.trim()) {
    normalized.avatar = agent.avatar.trim();
  }
  if (agent.workspace?.trim()) {
    normalized.workspace = agent.workspace.trim();
  }
  if (agent.model?.trim()) {
    normalized.model = agent.model.trim();
  }
  const runtime = agent.runtime?.trim() ?? agent.engine?.trim();
  if (runtime) {
    normalized.engine = runtime;
  }
  if (typeof agent.contextTokens === 'number') {
    normalized.contextTokens = Math.max(1000, agent.contextTokens);
  }
  if (typeof agent.maxToolIterations === 'number') {
    normalized.maxToolIterations = agent.maxToolIterations;
  }
  return normalized;
}
