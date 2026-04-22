import { Plus, Trash2 } from 'lucide-react';
import type { AgentProfileView } from '@/shared/lib/api';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/i18n';
import { parseOptionalInt } from '@/features/system-status/utils/runtime-config-agent.utils';

export function RuntimeAgentListCard(props: {
  agents: AgentProfileView[];
  onUpdateAgent: (index: number, patch: Partial<AgentProfileView>) => void;
  onRemoveAgent: (index: number) => void;
  onAddAgent: () => void;
  onSetDefaultAgent: (index: number, checked: boolean) => void;
  label?: string;
  help?: string;
  contextTokensLabel?: string;
  engineLabel?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.label ?? t('agentList')}</CardTitle>
        <CardDescription>{props.help ?? t('agentListHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.agents.map((agent, index) => (
          <div key={`${index}-${agent.id}`} className="rounded-xl border border-gray-200 p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={agent.id} onChange={(event) => props.onUpdateAgent(index, { id: event.target.value })} placeholder={t('agentIdPlaceholder')} />
              <Input value={agent.workspace ?? ''} onChange={(event) => props.onUpdateAgent(index, { workspace: event.target.value })} placeholder={t('workspaceOverridePlaceholder')} />
              <Input value={agent.model ?? ''} onChange={(event) => props.onUpdateAgent(index, { model: event.target.value })} placeholder={t('modelOverridePlaceholder')} />
              <Input value={agent.runtime ?? agent.engine ?? ''} onChange={(event) => props.onUpdateAgent(index, { runtime: event.target.value })} placeholder={props.engineLabel ?? t('engineOverridePlaceholder')} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={1000}
                  step={1000}
                  value={agent.contextTokens ?? ''}
                  onChange={(event) => props.onUpdateAgent(index, { contextTokens: parseOptionalInt(event.target.value) })}
                  placeholder={props.contextTokensLabel ?? t('contextTokensPlaceholder')}
                />
                <Input
                  type="number"
                  min={1}
                  value={agent.maxToolIterations ?? ''}
                  onChange={(event) => props.onUpdateAgent(index, { maxToolIterations: parseOptionalInt(event.target.value) })}
                  placeholder={t('maxToolsPlaceholder')}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Switch checked={Boolean(agent.default)} onCheckedChange={(checked) => props.onSetDefaultAgent(index, checked)} />
                <span>{t('defaultAgent')}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => props.onRemoveAgent(index)}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t('remove')}
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={props.onAddAgent}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addAgent')}
        </Button>
      </CardContent>
    </Card>
  );
}
