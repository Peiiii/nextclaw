import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { RuntimeEntryDraft } from '@/features/system-status/utils/runtime-config-agent.utils';

export function RuntimeEntryListCard(props: {
  entries: RuntimeEntryDraft[];
  onUpdateEntry: (index: number, patch: Partial<RuntimeEntryDraft>) => void;
  onRemoveEntry: (index: number) => void;
  onAddEntry: () => void;
  label?: string;
  help?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.label ?? 'Runtime Entries'}</CardTitle>
        <CardDescription>{props.help ?? '统一管理可见的 runtime entry 与其配置。'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.entries.map((entry, index) => (
          <div key={`${index}-${entry.id || 'runtime-entry'}`} className="rounded-xl border border-gray-200 p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={entry.id} onChange={(event) => props.onUpdateEntry(index, { id: event.target.value })} placeholder="entry id，例如 hermes" />
              <Input value={entry.label ?? ''} onChange={(event) => props.onUpdateEntry(index, { label: event.target.value })} placeholder="展示名称，例如 Hermes" />
              <Input value={entry.type} onChange={(event) => props.onUpdateEntry(index, { type: event.target.value })} placeholder="runtime type，例如 narp-stdio" />
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <span className="text-sm text-gray-700">Enabled</span>
                <Switch checked={entry.enabled !== false} onCheckedChange={(checked) => props.onUpdateEntry(index, { enabled: checked })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">Config JSON</label>
              <textarea
                className="min-h-32 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-mono"
                value={entry.configText}
                onChange={(event) => props.onUpdateEntry(index, { configText: event.target.value })}
                spellCheck={false}
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => props.onRemoveEntry(index)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={props.onAddEntry}>
          <Plus className="mr-2 h-4 w-4" />
          Add Runtime Entry
        </Button>
      </CardContent>
    </Card>
  );
}
