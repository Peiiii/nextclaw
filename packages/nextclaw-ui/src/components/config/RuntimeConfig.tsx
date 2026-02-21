import { useEffect, useMemo, useState } from 'react';
import { useConfig, useConfigSchema, useUpdateRuntime } from '@/hooks/useConfig';
import type { AgentBindingView, AgentProfileView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { hintForPath } from '@/lib/config-hints';
import { Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type DmScope = 'main' | 'per-peer' | 'per-channel-peer' | 'per-account-channel-peer';
type PeerKind = '' | 'direct' | 'group' | 'channel';

const DM_SCOPE_OPTIONS: Array<{ value: DmScope; label: string }> = [
  { value: 'main', label: 'main' },
  { value: 'per-peer', label: 'per-peer' },
  { value: 'per-channel-peer', label: 'per-channel-peer' },
  { value: 'per-account-channel-peer', label: 'per-account-channel-peer' }
];

function createEmptyAgent(): AgentProfileView {
  return {
    id: '',
    default: false,
    workspace: '',
    model: '',
    maxTokens: undefined,
    maxToolIterations: undefined
  };
}

function createEmptyBinding(): AgentBindingView {
  return {
    agentId: '',
    match: {
      channel: '',
      accountId: ''
    }
  };
}

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function RuntimeConfig() {
  const { data: config, isLoading } = useConfig();
  const { data: schema } = useConfigSchema();
  const updateRuntime = useUpdateRuntime();

  const [agents, setAgents] = useState<AgentProfileView[]>([]);
  const [bindings, setBindings] = useState<AgentBindingView[]>([]);
  const [dmScope, setDmScope] = useState<DmScope>('per-channel-peer');
  const [maxPingPongTurns, setMaxPingPongTurns] = useState(0);

  useEffect(() => {
    if (!config) {
      return;
    }
    setAgents(
      (config.agents.list ?? []).map((agent) => ({
        id: agent.id ?? '',
        default: Boolean(agent.default),
        workspace: agent.workspace ?? '',
        model: agent.model ?? '',
        maxTokens: agent.maxTokens,
        maxToolIterations: agent.maxToolIterations
      }))
    );
    setBindings(
      (config.bindings ?? []).map((binding) => ({
        agentId: binding.agentId ?? '',
        match: {
          channel: binding.match?.channel ?? '',
          accountId: binding.match?.accountId ?? '',
          peer: binding.match?.peer
            ? {
                kind: binding.match.peer.kind,
                id: binding.match.peer.id
              }
            : undefined
        }
      }))
    );
    setDmScope((config.session?.dmScope as DmScope) ?? 'per-channel-peer');
    setMaxPingPongTurns(config.session?.agentToAgent?.maxPingPongTurns ?? 0);
  }, [config]);

  const uiHints = schema?.uiHints;
  const dmScopeHint = hintForPath('session.dmScope', uiHints);
  const maxPingHint = hintForPath('session.agentToAgent.maxPingPongTurns', uiHints);
  const agentsHint = hintForPath('agents.list', uiHints);
  const bindingsHint = hintForPath('bindings', uiHints);

  const knownAgentIds = useMemo(() => {
    const ids = new Set<string>(['main']);
    agents.forEach((agent) => {
      const id = agent.id.trim();
      if (id) {
        ids.add(id);
      }
    });
    return ids;
  }, [agents]);

  const updateAgent = (index: number, patch: Partial<AgentProfileView>) => {
    setAgents((prev) => prev.map((agent, cursor) => (cursor === index ? { ...agent, ...patch } : agent)));
  };

  const updateBinding = (index: number, next: AgentBindingView) => {
    setBindings((prev) => prev.map((binding, cursor) => (cursor === index ? next : binding)));
  };

  const handleSave = () => {
    try {
      const normalizedAgents = agents.map((agent, index) => {
        const id = agent.id.trim();
        if (!id) {
          throw new Error(`agents.list[${index}].id is required`);
        }
        const normalized: AgentProfileView = { id };
        if (agent.default) {
          normalized.default = true;
        }
        if (agent.workspace?.trim()) {
          normalized.workspace = agent.workspace.trim();
        }
        if (agent.model?.trim()) {
          normalized.model = agent.model.trim();
        }
        if (typeof agent.maxTokens === 'number') {
          normalized.maxTokens = agent.maxTokens;
        }
        if (typeof agent.maxToolIterations === 'number') {
          normalized.maxToolIterations = agent.maxToolIterations;
        }
        return normalized;
      });

      const duplicates = normalizedAgents
        .map((agent) => agent.id)
        .filter((id, index, all) => all.indexOf(id) !== index);
      if (duplicates.length > 0) {
        toast.error(`Duplicate agent id: ${duplicates[0]}`);
        return;
      }

      const normalizedBindings = bindings.map((binding, index) => {
        const agentId = binding.agentId.trim();
        const channel = binding.match.channel.trim();
        const accountId = binding.match.accountId?.trim() ?? '';
        const peerKind = binding.match.peer?.kind;
        const peerId = binding.match.peer?.id?.trim() ?? '';

        if (!agentId) {
          throw new Error(`bindings[${index}].agentId is required`);
        }
        if (!knownAgentIds.has(agentId)) {
          throw new Error(`bindings[${index}].agentId '${agentId}' not found in agents.list/main`);
        }
        if (!channel) {
          throw new Error(`bindings[${index}].match.channel is required`);
        }

        const normalized: AgentBindingView = {
          agentId,
          match: {
            channel
          }
        };

        if (accountId) {
          normalized.match.accountId = accountId;
        }

        if (peerKind) {
          if (!peerId) {
            throw new Error(`bindings[${index}].match.peer.id is required when peer.kind is set`);
          }
          normalized.match.peer = {
            kind: peerKind,
            id: peerId
          };
        }

        return normalized;
      });

      updateRuntime.mutate({
        data: {
          agents: { list: normalizedAgents },
          bindings: normalizedBindings,
          session: {
            dmScope,
            agentToAgent: {
              maxPingPongTurns: Math.min(5, Math.max(0, maxPingPongTurns))
            }
          }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message);
    }
  };

  if (isLoading || !config) {
    return <div className="p-8 text-gray-400">Loading runtime settings...</div>;
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Routing & Runtime</h2>
        <p className="text-sm text-gray-500 mt-1">
          Align multi-agent routing with OpenClaw: bindings, agent pool, and DM scope.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dmScopeHint?.label ?? 'DM Scope'}</CardTitle>
          <CardDescription>{dmScopeHint?.help ?? 'Control how direct-message sessions are isolated.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-800">{dmScopeHint?.label ?? 'DM Scope'}</label>
            <select
              value={dmScope}
              onChange={(event) => setDmScope(event.target.value as DmScope)}
              className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {DM_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-800">
              {maxPingHint?.label ?? 'Max Ping-Pong Turns'}
            </label>
            <Input
              type="number"
              min={0}
              max={5}
              value={maxPingPongTurns}
              onChange={(event) => setMaxPingPongTurns(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
            />
            <p className="text-xs text-gray-500">
              {maxPingHint?.help ?? 'Set to 0 to block automatic agent-to-agent ping-pong loops.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{agentsHint?.label ?? 'Agent List'}</CardTitle>
          <CardDescription>{agentsHint?.help ?? 'Run multiple fixed-role agents in one gateway process.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {agents.map((agent, index) => (
            <div key={`${index}-${agent.id}`} className="rounded-xl border border-gray-200 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  value={agent.id}
                  onChange={(event) => updateAgent(index, { id: event.target.value })}
                  placeholder="Agent ID (e.g. engineer)"
                />
                <Input
                  value={agent.workspace ?? ''}
                  onChange={(event) => updateAgent(index, { workspace: event.target.value })}
                  placeholder="Workspace override (optional)"
                />
                <Input
                  value={agent.model ?? ''}
                  onChange={(event) => updateAgent(index, { model: event.target.value })}
                  placeholder="Model override (optional)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={agent.maxTokens ?? ''}
                    onChange={(event) =>
                      updateAgent(index, {
                        maxTokens: parseOptionalInt(event.target.value)
                      })
                    }
                    placeholder="Max tokens"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={agent.maxToolIterations ?? ''}
                    onChange={(event) =>
                      updateAgent(index, {
                        maxToolIterations: parseOptionalInt(event.target.value)
                      })
                    }
                    placeholder="Max tools"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Switch
                    checked={Boolean(agent.default)}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        updateAgent(index, { default: false });
                        return;
                      }
                      setAgents((prev) =>
                        prev.map((entry, cursor) => ({
                          ...entry,
                          default: cursor === index
                        }))
                      );
                    }}
                  />
                  <span>Default agent</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setAgents((prev) => prev.filter((_, cursor) => cursor !== index))}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={() => setAgents((prev) => [...prev, createEmptyAgent()])}>
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{bindingsHint?.label ?? 'Bindings'}</CardTitle>
          <CardDescription>
            {bindingsHint?.help ?? 'Route inbound message by channel + account + peer to target agent.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bindings.map((binding, index) => {
            const peerKind = (binding.match.peer?.kind ?? '') as PeerKind;
            return (
              <div key={`${index}-${binding.agentId}`} className="rounded-xl border border-gray-200 p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Input
                    value={binding.agentId}
                    onChange={(event) => updateBinding(index, { ...binding, agentId: event.target.value })}
                    placeholder="Target agent ID"
                  />
                  <Input
                    value={binding.match.channel}
                    onChange={(event) =>
                      updateBinding(index, {
                        ...binding,
                        match: {
                          ...binding.match,
                          channel: event.target.value
                        }
                      })
                    }
                    placeholder="Channel (e.g. discord)"
                  />
                  <Input
                    value={binding.match.accountId ?? ''}
                    onChange={(event) =>
                      updateBinding(index, {
                        ...binding,
                        match: {
                          ...binding.match,
                          accountId: event.target.value
                        }
                      })
                    }
                    placeholder="Account ID (optional)"
                  />
                  <select
                    value={peerKind}
                    onChange={(event) => {
                      const nextKind = event.target.value as PeerKind;
                      if (!nextKind) {
                        updateBinding(index, {
                          ...binding,
                          match: {
                            ...binding.match,
                            peer: undefined
                          }
                        });
                        return;
                      }
                      updateBinding(index, {
                        ...binding,
                        match: {
                          ...binding.match,
                          peer: {
                            kind: nextKind,
                            id: binding.match.peer?.id ?? ''
                          }
                        }
                      });
                    }}
                    className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Peer kind (optional)</option>
                    <option value="direct">direct</option>
                    <option value="group">group</option>
                    <option value="channel">channel</option>
                  </select>
                  <Input
                    value={binding.match.peer?.id ?? ''}
                    onChange={(event) =>
                      updateBinding(index, {
                        ...binding,
                        match: {
                          ...binding.match,
                          peer: peerKind
                            ? {
                                kind: peerKind,
                                id: event.target.value
                              }
                            : undefined
                        }
                      })
                    }
                    placeholder="Peer ID (requires peer kind)"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBindings((prev) => prev.filter((_, cursor) => cursor !== index))}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}

          <Button type="button" variant="outline" onClick={() => setBindings((prev) => [...prev, createEmptyBinding()])}>
            <Plus className="h-4 w-4 mr-2" />
            Add Binding
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={updateRuntime.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateRuntime.isPending ? 'Saving...' : 'Save Runtime Settings'}
        </Button>
      </div>
    </div>
  );
}
