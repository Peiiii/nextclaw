import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface KeyValueEditorProps {
  value: Record<string, string> | null;
  onChange: (headers: Record<string, string>) => void;
  className?: string;
}

export function KeyValueEditor({ value, onChange, className }: KeyValueEditorProps) {
  const entries = value ? Object.entries(value) : [];

  const updateEntry = (index: number, key: string, val: string) => {
    const newEntries = [...entries];
    newEntries[index] = [key, val];
    onChange(Object.fromEntries(newEntries));
  };

  const addEntry = () => {
    onChange({ ...value, '': '' });
  };

  const removeEntry = (index: number) => {
    const newEntries = entries.filter((_, i) => i !== index);
    onChange(Object.fromEntries(newEntries));
  };

  return (
    <div className={cn('space-y-2', className)}>
      {entries.map(([key, val], index) => (
        <div key={index} className="flex gap-2">
          <Input
            type="text"
            value={key}
            onChange={(e) => updateEntry(index, e.target.value, val)}
            placeholder={t('headerName')}
            className="flex-1"
          />
          <Input
            type="text"
            value={val}
            onChange={(e) => updateEntry(index, key, e.target.value)}
            placeholder={t('headerValue')}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeEntry(index)}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addEntry}>
        <Plus className="h-4 w-4 mr-2" />
        {t('add')}
      </Button>
    </div>
  );
}
