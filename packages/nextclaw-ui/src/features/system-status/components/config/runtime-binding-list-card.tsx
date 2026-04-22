import type { AgentBindingView } from '@/shared/lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { t } from '@/shared/lib/i18n';
import type { PeerKind } from '@/features/system-status/utils/runtime-config-agent.utils';

export function RuntimeBindingListCard(props: {
  bindings: AgentBindingView[];
  onUpdateBinding: (index: number, next: AgentBindingView) => void;
  onRemoveBinding: (index: number) => void;
  onAddBinding: () => void;
  label?: string;
  help?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.label ?? t('bindings')}</CardTitle>
        <CardDescription>{props.help ?? t('bindingsHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.bindings.map((binding, index) => {
          const peerKind = (binding.match.peer?.kind ?? '') as PeerKind;
          return (
            <div key={`${index}-${binding.agentId}`} className="rounded-xl border border-gray-200 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input value={binding.agentId} onChange={(event) => props.onUpdateBinding(index, { ...binding, agentId: event.target.value })} placeholder={t('targetAgentIdPlaceholder')} />
                <Input value={binding.match.channel} onChange={(event) => props.onUpdateBinding(index, { ...binding, match: { ...binding.match, channel: event.target.value } })} placeholder={t('channelPlaceholder')} />
                <Input value={binding.match.accountId ?? ''} onChange={(event) => props.onUpdateBinding(index, { ...binding, match: { ...binding.match, accountId: event.target.value } })} placeholder={t('accountIdOptionalPlaceholder')} />
                <Select
                  value={peerKind || '__none__'}
                  onValueChange={(value) => {
                    const nextKind = value === '__none__' ? '' : (value as PeerKind);
                    props.onUpdateBinding(
                      index,
                      nextKind
                        ? { ...binding, match: { ...binding.match, peer: { kind: nextKind, id: binding.match.peer?.id ?? '' } } }
                        : { ...binding, match: { ...binding.match, peer: undefined } }
                    );
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
                    props.onUpdateBinding(index, {
                      ...binding,
                      match: {
                        ...binding.match,
                        peer: peerKind ? { kind: peerKind, id: event.target.value } : undefined
                      }
                    })
                  }
                  placeholder={t('peerIdPlaceholder')}
                />
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => props.onRemoveBinding(index)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('remove')}
                </Button>
              </div>
            </div>
          );
        })}
        <Button type="button" variant="outline" onClick={props.onAddBinding}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addBinding')}
        </Button>
      </CardContent>
    </Card>
  );
}
