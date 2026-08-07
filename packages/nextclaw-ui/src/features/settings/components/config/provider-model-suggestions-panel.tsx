import { useMemo, useState } from 'react';
import { ChevronRight, Search, Sparkles } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { t } from '@/shared/lib/i18n';

const SEARCH_THRESHOLD = 20;
const BULK_ADD_LIMIT = 50;
const VISIBLE_RESULT_LIMIT = 50;

type ProviderModelSuggestionsPanelProps = {
  expanded: boolean;
  models: string[];
  fetchedTotal: number;
  source: 'background' | 'fetched';
  onExpandedChange: (expanded: boolean) => void;
  onAddModels: (models: string[]) => void;
};

export function ProviderModelSuggestionsPanel(props: ProviderModelSuggestionsPanelProps) {
  const { expanded, fetchedTotal, models, source, onExpandedChange, onAddModels } = props;
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery
      ? models.filter((model) => model.toLowerCase().includes(normalizedQuery))
      : models;
  }, [models, query]);
  const visibleModels = filteredModels.slice(0, VISIBLE_RESULT_LIMIT);
  const selectedModels = useMemo(
    () => models.filter((model) => selection.has(model)),
    [models, selection]
  );
  const toggleModel = (model: string) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(model)) {
        next.delete(model);
      } else {
        next.add(model);
      }
      return next;
    });
  };
  const addModels = (selected: string[]) => {
    if (selected.length === 0) {
      return;
    }
    onAddModels(selected);
    setQuery('');
    setSelection(new Set());
  };
  const summaryKey = source === 'fetched'
    ? 'providerModelsFetchedSuggestionsSummary'
    : 'providerModelsSuggestionsSummary';

  if (source === 'fetched' && models.length === 0) {
    return (
      <div className='flex items-center gap-2 rounded-xl bg-muted/35 px-3 py-2 text-xs text-muted-foreground' role='status'>
        <Sparkles className='h-3.5 w-3.5 shrink-0 text-primary' />
        <span>{t('providerModelsFetchedAllConfigured').replace('{count}', String(fetchedTotal))}</span>
      </div>
    );
  }

  return (
    <div className='rounded-xl bg-muted/35 p-2'>
      <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
        <button
          type='button'
          aria-expanded={expanded}
          className='flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground'
          onClick={() => onExpandedChange(!expanded)}
        >
          <Sparkles className='h-3.5 w-3.5 shrink-0 text-primary' />
          <span className='min-w-0 flex-1 truncate'>
            {t(summaryKey).replace('{count}', String(models.length))}
          </span>
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        {models.length <= BULK_ADD_LIMIT ? (
          <button
            type='button'
            className='shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10'
            onClick={() => addModels(models)}
          >
            {t('providerModelsSuggestionsAddAll')}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className='px-1 pb-1'>
          {models.length > SEARCH_THRESHOLD ? (
            <div className='relative px-2 pb-1 pt-1.5'>
              <Search className='pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('providerModelsSuggestionsSearchPlaceholder')}
                className='h-8 rounded-lg pl-8 text-xs'
              />
            </div>
          ) : null}
          <div className='custom-scrollbar max-h-44 overflow-y-auto overscroll-contain'>
            {visibleModels.map((modelName) => (
              <label
                key={modelName}
                className='grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/70'
              >
                <input
                  type='checkbox'
                  checked={selection.has(modelName)}
                  onChange={() => toggleModel(modelName)}
                  aria-label={t('providerModelsSuggestionSelect').replace('{model}', modelName)}
                  className='h-3.5 w-3.5 shrink-0 accent-primary'
                />
                <span className='block min-w-0 truncate text-xs text-foreground' title={modelName}>{modelName}</span>
              </label>
            ))}
            {filteredModels.length === 0 ? (
              <p className='px-2 py-4 text-center text-xs text-muted-foreground'>
                {t('providerModelsSuggestionsSearchEmpty')}
              </p>
            ) : null}
          </div>
          {filteredModels.length > visibleModels.length ? (
            <p className='px-2 pt-1 text-[11px] text-muted-foreground'>
              {t('providerModelsSuggestionsShowing')
                .replace('{visible}', String(visibleModels.length))
                .replace('{count}', String(filteredModels.length))}
            </p>
          ) : null}
          <div className='flex items-center justify-between gap-2 px-2 pt-1.5'>
            <span className='text-[11px] text-muted-foreground'>
              {t('providerModelsSuggestionsSelected').replace('{count}', String(selectedModels.length))}
            </span>
            <button
              type='button'
              disabled={selectedModels.length === 0}
              className='shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-45'
              onClick={() => addModels(selectedModels)}
            >
              {t('providerModelsSuggestionsAddSelected')}
            </button>
          </div>
          <p className='px-2 pb-1 pt-1 text-[11px] text-muted-foreground'>{t('providerModelsSuggestionsSaveHint')}</p>
        </div>
      ) : null}
    </div>
  );
}
