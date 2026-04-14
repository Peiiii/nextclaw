import { useEffect, useMemo, useState } from 'react';
import { useConfig, useConfigSchema, useUpdateRuntime } from '@/hooks/useConfig';
import type { AgentBindingView, AgentProfileView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RuntimeControlCard } from '@/components/config/runtime-control-card';
import { RuntimePresenceCard } from '@/components/config/runtime-presence-card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createEmptyRuntimeAgent,
  createEmptyRuntimeBinding,
  hydrateRuntimeAgent,
  hydrateRuntimeBinding,
  parseOptionalInt,
  toPersistedRuntimeAgent
} from '@/components/config/runtime-config-agent.utils';
import { hintForPath } from '@/lib/config-hints';
import { t } from '@/lib/i18n';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
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

function RuntimeConfigOverview() {
  return (
    <>
      <PageHeader title={t('runtimePageTitle')} description={t('runtimePageDescription')} />
      <RuntimeControlCard />
      <RuntimePresenceCard />
    </>
  );
}

export function RuntimeConfig() {
  const { data: config, isLoading } = useConfig();
  const { data: schema } = useConfigSchema();
  const updateRuntime = useUpdateRuntime();

  const [agents, setAgents] = useState<AgentProfileView[]>([]);
  const [bindings, setBindings] = useState<AgentBindingView[]>([]);
  const [dmScope, setDmScope] = useState<DmScope>('per-channel-peer');
  const [defaultContextTokens, setDefaultContextTokens] = useState(200000);
  const [defaultEngine, setDefaultEngine] = useState('native');

  useEffect(() => {
    if (!config) {
      return;
    }
    setAgents((config.agents.list ?? []).map(hydrateRuntimeAgent));
    setBindings((config.bindings ?? []).map(hydrateRuntimeBinding));
    setDmScope((config.session?.dmScope as DmScope) ?? 'per-channel-peer');
    setDefaultContextTokens(config.agents.defaults.contextTokens ?? 200000);
    setDefaultEngine(config.agents.defaults.engine ?? 'native');
  }, [config]);

  const uiHints = schema?.uiHints;
  const dmScopeHint = hintForPath('session.dmScope', uiHints);
  const defaultContextTokensHint = hintForPath('agents.defaults.contextTokens', uiHints);
  const defaultEngineHint = hintForPath('agents.defaults.engine', uiHints);
  const agentContextTokensHint = hintForPath('agents.list.*.contextTokens', uiHints);
  const agentEngineHint = hintForPath('agents.list.*.engine', uiHints);
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
          throw new Error(t('agentIdRequiredError').replace('{index}', String(index)));
        }
        return toPersistedRuntimeAgent(agent);
      });

      const duplicates = normalizedAgents
        .map((agent) => agent.id)
        .filter((id, index, all) => all.indexOf(id) !== index);
      if (duplicates.length > 0) {
        toast.error(`${t('duplicateAgentId')}: ${duplicates[0]}`);
        return;
      }

      const normalizedBindings = bindings.map((binding, index) => {
        const agentId = binding.agentId.trim();
        const channel = binding.match.channel.trim();
        const accountId = binding.match.accountId?.trim() ?? '';
        const peerKind = binding.match.peer?.kind;
        const peerId = binding.match.peer?.id?.trim() ?? '';

        if (!agentId) {
          throw new Error(t('bindingAgentIdRequired').replace('{index}', String(index)));
        }
        if (!knownAgentIds.has(agentId)) {
          throw new Error(`${t('bindingAgentIdNotFound').replace('{index}', String(index))}: ${agentId}`);
        }
        if (!channel) {
          throw new Error(t('bindingChannelRequired').replace('{index}', String(index)));
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
            throw new Error(t('bindingPeerIdRequired').replace('{index}', String(index)));
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
          agents: {
            defaults: {
              contextTokens: Math.max(1000, defaultContextTokens),
              engine: defaultEngine.trim() || 'native'
            },
            list: normalizedAgents
          },
          bindings: normalizedBindings,
          session: {
            dmScope
          }
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message);
    }
  };

  if (isLoading || !config) return <div className="p-8 text-gray-400">{t('runtimeLoading')}</div>;

  return (
    <PageLayout className="space-y-6">
      <RuntimeConfigOverview />
      <Card>
        <CardHeader>
          <CardTitle>{dmScopeHint?.label ?? t('dmScope')}</CardTitle>
          <CardDescription>{dmScopeHint?.help ?? t('dmScopeHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-800">
              {defaultContextTokensHint?.label ?? t('defaultContextTokens')}
            </label>
            <Input
              type="number"
              min={1000}
              step={1000}
              value={defaultContextTokens}
              onChange={(event) => setDefaultContextTokens(Math.max(1000, Number.parseInt(event.target.value, 10) || 1000))}
            />
            <p className="text-xs text-gray-500">
              {defaultContextTokensHint?.help ?? t('defaultContextTokensHelp')}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-800">
              {defaultEngineHint?.label ?? t('defaultEngine')}
            </label>
            <Input
              value={defaultEngine}
              onChange={(event) => setDefaultEngine(event.target.value)}
              placeholder={t('defaultEnginePlaceholder')}
            />
            <p className="text-xs text-gray-500">
              {defaultEngineHint?.help ?? t('defaultEngineHelp')}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-800">{dmScopeHint?.label ?? t('dmScope')}</label>
            <Select value={dmScope} onValueChange={(v) => setDmScope(v as DmScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DM_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{agentsHint?.label ?? t('agentList')}</CardTitle>
          <CardDescription>{agentsHint?.help ?? t('agentListHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {agents.map((agent, index) => (
            <div key={`${index}-${agent.id}`} className="rounded-xl border border-gray-200 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  value={agent.id}
                  onChange={(event) => updateAgent(index, { id: event.target.value })}
                  placeholder={t('agentIdPlaceholder')}
                />
                <Input
                  value={agent.workspace ?? ''}
                  onChange={(event) => updateAgent(index, { workspace: event.target.value })}
                  placeholder={t('workspaceOverridePlaceholder')}
                />
                <Input
                  value={agent.model ?? ''}
                  onChange={(event) => updateAgent(index, { model: event.target.value })}
                  placeholder={t('modelOverridePlaceholder')}
                />
                <Input
                  value={agent.runtime ?? agent.engine ?? ''}
                  onChange={(event) => updateAgent(index, { runtime: event.target.value })}
                  placeholder={agentEngineHint?.label ?? t('engineOverridePlaceholder')}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={1000}
                    step={1000}
                    value={agent.contextTokens ?? ''}
                    onChange={(event) =>
                      updateAgent(index, {
                        contextTokens: parseOptionalInt(event.target.value)
                      })
                    }
                    placeholder={agentContextTokensHint?.label ?? t('contextTokensPlaceholder')}
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
                    placeholder={t('maxToolsPlaceholder')}
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
                  <span>{t('defaultAgent')}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setAgents((prev) => prev.filter((_, cursor) => cursor !== index))}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('remove')}
                </Button>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={() => setAgents((prev) => [...prev, createEmptyRuntimeAgent()])}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addAgent')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{bindingsHint?.label ?? t('bindings')}</CardTitle>
          <CardDescription>
            {bindingsHint?.help ?? t('bindingsHelp')}
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
                    placeholder={t('targetAgentIdPlaceholder')}
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
                    placeholder={t('channelPlaceholder')}
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
                    placeholder={t('accountIdOptionalPlaceholder')}
                  />
                  <Select
                    value={peerKind || '__none__'}
                    onValueChange={(v) => {
                      const nextKind = v === '__none__' ? '' : v as PeerKind;
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
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('peerKindOptional')}</SelectItem>
                      <SelectItem value="direct">direct</SelectItem>
                      <SelectItem value="group">group</SelectItem>
                      <SelectItem value="channel">channel</SelectItem>
                    </SelectContent>
                  </Select>
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
                    placeholder={t('peerIdPlaceholder')}
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
                    {t('remove')}
                  </Button>
                </div>
              </div>
            );
          })}

          <Button type="button" variant="outline" onClick={() => setBindings((prev) => [...prev, createEmptyRuntimeBinding()])}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addBinding')}
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={updateRuntime.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateRuntime.isPending ? t('saving') : t('saveRuntimeSettings')}
        </Button>
      </div>
    </PageLayout>
  );
}
