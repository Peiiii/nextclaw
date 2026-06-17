import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/i18n';
import type { RuntimeEntryDraft } from '@/features/system-status/utils/runtime-config-agent.utils';

export function RuntimeEntryListCard({
  entries,
  onAddEntry,
  onRemoveEntry,
  onUpdateEntry
}: {
  entries: RuntimeEntryDraft[];
  onUpdateEntry: (index: number, patch: Partial<RuntimeEntryDraft>) => void;
  onRemoveEntry: (index: number) => void;
  onAddEntry: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('runtimeEntries')}</CardTitle>
        <CardDescription>{t('runtimeEntriesHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map((entry, index) => (
          <div key={`${index}-${entry.id || 'runtime-entry'}`} className="rounded-xl border border-gray-200 p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={entry.id} onChange={(event) => onUpdateEntry(index, { id: event.target.value })} placeholder={t('runtimeEntryIdPlaceholder')} />
              <Input value={entry.label ?? ''} onChange={(event) => onUpdateEntry(index, { label: event.target.value })} placeholder={t('runtimeEntryLabelPlaceholder')} />
              <Input value={entry.type} onChange={(event) => onUpdateEntry(index, { type: event.target.value })} placeholder={t('runtimeEntryTypePlaceholder')} />
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <span className="text-sm text-gray-700">{t('enabled')}</span>
                <Switch checked={entry.enabled !== false} onCheckedChange={(checked) => onUpdateEntry(index, { enabled: checked })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">{t('runtimeEntryConfigJson')}</label>
              <textarea
                className="min-h-32 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-mono"
                value={entry.configText}
                onChange={(event) => onUpdateEntry(index, { configText: event.target.value })}
                spellCheck={false}
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => onRemoveEntry(index)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('delete')}
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={onAddEntry}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addRuntimeEntry')}
        </Button>
      </CardContent>
    </Card>
  );
}
