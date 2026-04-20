import type { AgentBindingView, AgentProfileView, ConfigView, RuntimeConfigUpdate, RuntimeEntryView } from '@/api/types';
import { t } from '@/lib/i18n';

export type DmScope = 'main' | 'per-peer' | 'per-channel-peer' | 'per-account-channel-peer';
export type PeerKind = '' | 'direct' | 'group' | 'channel';
export type RuntimeEntryDraft = RuntimeEntryView & { id: string; configText: string };
export type RuntimeConfigEditorState = { agents: AgentProfileView[]; bindings: AgentBindingView[]; runtimeEntries: RuntimeEntryDraft[]; dmScope: DmScope; defaultContextTokens: number; defaultEngine: string };

const DEFAULT_NARP_STDIO_ENTRY_CONFIG = {
  wireDialect: 'acp',
  processScope: 'per-session',
  command: '',
  args: ['acp'],
  env: {},
  cwd: '',
  startupTimeoutMs: 8000,
  probeTimeoutMs: 3000,
  requestTimeoutMs: 120000
};

export function createEmptyRuntimeAgent(): AgentProfileView {
  return { id: '', default: false, workspace: '', model: '', runtime: '', contextTokens: undefined, maxToolIterations: undefined };
}

export function createEmptyRuntimeBinding(): AgentBindingView {
  return { agentId: '', match: { channel: '', accountId: '' } };
}

export function createEmptyRuntimeEntry(): RuntimeEntryDraft {
  return { id: '', enabled: true, label: '', type: 'narp-stdio', config: DEFAULT_NARP_STDIO_ENTRY_CONFIG, configText: JSON.stringify(DEFAULT_NARP_STDIO_ENTRY_CONFIG, null, 2) };
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
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function createRuntimeConfigEditorState(config: ConfigView): RuntimeConfigEditorState {
  return {
    agents: (config.agents.list ?? []).map(hydrateRuntimeAgent),
    bindings: (config.bindings ?? []).map(hydrateRuntimeBinding),
    runtimeEntries: Object.entries(config.agents.runtimes?.entries ?? {}).map(([id, entry]) => ({ id, enabled: entry.enabled !== false, label: entry.label ?? '', type: entry.type, config: entry.config ?? {}, configText: JSON.stringify(entry.config ?? {}, null, 2) })),
    dmScope: (config.session?.dmScope as DmScope) ?? 'per-channel-peer',
    defaultContextTokens: config.agents.defaults.contextTokens ?? 200000,
    defaultEngine: config.agents.defaults.engine ?? 'native'
  };
}

export function toPersistedRuntimeAgent(agent: AgentProfileView): AgentProfileView {
  const normalized: AgentProfileView = { id: agent.id.trim() };
  if (agent.default) normalized.default = true;
  if (agent.displayName?.trim()) normalized.displayName = agent.displayName.trim();
  if (agent.description?.trim()) normalized.description = agent.description.trim();
  if (agent.avatar?.trim()) normalized.avatar = agent.avatar.trim();
  if (agent.workspace?.trim()) normalized.workspace = agent.workspace.trim();
  if (agent.model?.trim()) normalized.model = agent.model.trim();
  const runtime = agent.runtime?.trim() ?? agent.engine?.trim();
  if (runtime) normalized.engine = runtime;
  if (typeof agent.contextTokens === 'number') normalized.contextTokens = Math.max(1000, agent.contextTokens);
  if (typeof agent.maxToolIterations === 'number') normalized.maxToolIterations = agent.maxToolIterations;
  return normalized;
}

export function createRuntimeConfigUpdatePayload(input: {
  agents: AgentProfileView[];
  bindings: AgentBindingView[];
  runtimeEntries: RuntimeEntryDraft[];
  dmScope: DmScope;
  defaultContextTokens: number;
  defaultEngine: string;
  knownAgentIds: Set<string>;
}): RuntimeConfigUpdate {
  const normalizedAgents = input.agents.map((agent, index) => {
    const id = agent.id.trim();
    if (!id) throw new Error(t('agentIdRequiredError').replace('{index}', String(index)));
    return toPersistedRuntimeAgent(agent);
  });
  const duplicates = normalizedAgents.map((agent) => agent.id).filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`${t('duplicateAgentId')}: ${duplicates[0]}`);
  }
  const normalizedBindings = input.bindings.map((binding, index) => {
    const agentId = binding.agentId.trim();
    const channel = binding.match.channel.trim();
    const accountId = binding.match.accountId?.trim() ?? '';
    const peerKind = binding.match.peer?.kind;
    const peerId = binding.match.peer?.id?.trim() ?? '';
    if (!agentId) throw new Error(t('bindingAgentIdRequired').replace('{index}', String(index)));
    if (!input.knownAgentIds.has(agentId)) throw new Error(`${t('bindingAgentIdNotFound').replace('{index}', String(index))}: ${agentId}`);
    if (!channel) throw new Error(t('bindingChannelRequired').replace('{index}', String(index)));
    const normalized: AgentBindingView = { agentId, match: { channel } };
    if (accountId) {
      normalized.match.accountId = accountId;
    }
    if (peerKind) {
      if (!peerId) throw new Error(t('bindingPeerIdRequired').replace('{index}', String(index)));
      normalized.match.peer = { kind: peerKind, id: peerId };
    }
    return normalized;
  });
  const normalizedRuntimeEntries = input.runtimeEntries.reduce<Record<string, RuntimeEntryView>>((entries, entry, index) => {
    const id = entry.id.trim();
    const type = entry.type.trim();
    if (!id) throw new Error(`Runtime entry id is required at index ${index}.`);
    if (!type) throw new Error(`Runtime entry type is required for "${id}".`);
    if (entries[id]) throw new Error(`Duplicate runtime entry id: ${id}`);
    const configValue = entry.configText.trim() ? JSON.parse(entry.configText) : {};
    if (configValue && (typeof configValue !== 'object' || Array.isArray(configValue))) throw new Error(`Runtime entry config for "${id}" must be a JSON object.`);
    entries[id] = {
      enabled: entry.enabled !== false,
      ...(entry.label?.trim() ? { label: entry.label.trim() } : {}),
      type,
      config: (configValue as Record<string, unknown>) ?? {}
    };
    return entries;
  }, {});
  return {
    agents: {
      defaults: {
        contextTokens: Math.max(1000, input.defaultContextTokens),
        engine: input.defaultEngine.trim() || 'native'
      },
      list: normalizedAgents,
      runtimes: {
        entries: normalizedRuntimeEntries
      }
    },
    bindings: normalizedBindings,
    session: {
      dmScope: input.dmScope
    }
  };
}
