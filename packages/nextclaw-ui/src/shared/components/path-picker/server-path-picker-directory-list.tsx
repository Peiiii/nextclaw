import type { KeyboardEvent } from 'react';
import { Folder } from 'lucide-react';
import type { ServerPathEntryView } from '@/shared/lib/api';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';

type ServerPathPickerDirectoryListProps = {
  entries: readonly ServerPathEntryView[];
  emptyMessage: string;
  disabled: boolean;
  onOpen: (path: string) => void;
  onSelect: (path: string) => void;
  selectedPath: string;
};

export function ServerPathPickerDirectoryList({
  entries,
  emptyMessage,
  disabled,
  onOpen,
  onSelect,
  selectedPath,
}: ServerPathPickerDirectoryListProps) {
  const moveSelection = (
    event: KeyboardEvent<HTMLButtonElement>,
    direction: -1 | 1,
  ) => {
    event.preventDefault();
    const rows = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[data-server-path-row]',
      ) ?? [],
    );
    const currentIndex = rows.indexOf(event.currentTarget);
    const nextRow = rows[currentIndex + direction];
    if (!nextRow) {
      return;
    }
    nextRow.focus();
    nextRow.click();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="grid grid-cols-[minmax(0,1fr)_8rem] border-b border-border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
        <span>{t('pathPickerNameColumn')}</span>
        <span>{t('pathPickerTypeColumn')}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {entries.length > 0 ? (
          <div role="listbox" aria-label={t('pathPickerDirectoryList')} className="p-1.5">
            {entries.map((entry) => {
              const selected = selectedPath === entry.path;
              return (
                <button
                  key={entry.path}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-server-path-row
                  className={cn(
                    'grid w-full grid-cols-[minmax(0,1fr)_8rem] items-center rounded-sm border border-transparent px-2 py-1.5 text-left text-sm text-foreground outline-none transition-colors',
                    selected
                      ? 'border-primary/25 bg-primary/15'
                      : 'hover:bg-accent/70 focus-visible:border-primary/35 focus-visible:bg-accent/70',
                  )}
                  onClick={() => onSelect(entry.path)}
                  onDoubleClick={() => onOpen(entry.path)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onOpen(entry.path);
                    }
                    if (event.key === 'ArrowDown') {
                      moveSelection(event, 1);
                    }
                    if (event.key === 'ArrowUp') {
                      moveSelection(event, -1);
                    }
                  }}
                  disabled={disabled}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder className="h-4 w-4 shrink-0 fill-amber-300 text-amber-500" />
                    <span className="truncate">{entry.name}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t('pathPickerDirectoryType')}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid h-full min-h-48 place-items-center px-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
