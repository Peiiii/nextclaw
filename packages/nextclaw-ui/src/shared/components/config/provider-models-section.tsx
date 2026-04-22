import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { t } from '@/shared/lib/i18n';
import type { ThinkingLevel } from '@/shared/lib/api';
import { Plus, Settings2, X } from 'lucide-react';

type ModelThinkingConfig = Record<string, { supported: ThinkingLevel[]; default?: ThinkingLevel | null }>;

type ProviderModelsSectionProps = {
  models: string[];
  modelThinking: ModelThinkingConfig;
  modelDraft: string;
  showModelInput: boolean;
  onModelDraftChange: (value: string) => void;
  onShowModelInputChange: (value: boolean) => void;
  onAddModel: () => void;
  onRemoveModel: (modelName: string) => void;
  onToggleModelThinkingLevel: (modelName: string, level: ThinkingLevel) => void;
  onSetModelThinkingDefault: (modelName: string, level: ThinkingLevel | null) => void;
  thinkingLevels: ThinkingLevel[];
  formatThinkingLevelLabel: (level: ThinkingLevel) => string;
};

export function ProviderModelsSection(props: ProviderModelsSectionProps) {
  const {
    models,
    modelThinking,
    modelDraft,
    showModelInput,
    onModelDraftChange,
    onShowModelInputChange,
    onAddModel,
    onRemoveModel,
    onToggleModelThinkingLevel,
    onSetModelThinkingDefault,
    thinkingLevels,
    formatThinkingLevelLabel
  } = props;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-900">{t('providerModelsTitle')}</Label>
        {!showModelInput ? (
          <button
            type="button"
            onClick={() => onShowModelInputChange(true)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
          >
            <Plus className="h-3 w-3" />
            {t('providerAddModel')}
          </button>
        ) : null}
      </div>

      {showModelInput ? (
        <div className="flex items-center gap-2">
          <Input
            value={modelDraft}
            onChange={(event) => onModelDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onAddModel();
              }
              if (event.key === 'Escape') {
                onShowModelInputChange(false);
                onModelDraftChange('');
              }
            }}
            placeholder={t('providerModelInputPlaceholder')}
            className="flex-1 rounded-xl"
            autoFocus
          />
          <Button type="button" size="sm" onClick={onAddModel} disabled={modelDraft.trim().length === 0}>
            {t('add')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onShowModelInputChange(false);
              onModelDraftChange('');
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {models.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
          <p className="text-sm text-gray-500">{t('providerModelsEmptyShort')}</p>
          {!showModelInput ? (
            <button
              type="button"
              onClick={() => onShowModelInputChange(true)}
              className="mt-2 text-sm font-medium text-primary hover:text-primary/80"
            >
              {t('providerAddFirstModel')}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {models.map((modelName) => {
            const thinkingEntry = modelThinking[modelName];
            const supportedLevels = thinkingEntry?.supported ?? [];
            const defaultThinkingLevel = thinkingEntry?.default ?? null;

            return (
              <div
                key={modelName}
                className="group inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5"
              >
                <span className="max-w-[140px] truncate text-sm text-gray-800 sm:max-w-[220px]">{modelName}</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 opacity-100 transition-opacity hover:bg-gray-100 hover:text-gray-600 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      aria-label={t('providerModelThinkingTitle')}
                      title={t('providerModelThinkingTitle')}
                    >
                      <Settings2 className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-800">{t('providerModelThinkingTitle')}</p>
                      <p className="text-xs text-gray-500">{t('providerModelThinkingHint')}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {thinkingLevels.map((level) => {
                        const selected = supportedLevels.includes(level);
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => onToggleModelThinkingLevel(modelName, level)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                              selected
                                ? 'border-primary bg-primary text-white'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:text-primary'
                            }`}
                          >
                            {formatThinkingLevelLabel(level)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700">{t('providerModelThinkingDefault')}</Label>
                      <Select
                        value={defaultThinkingLevel ?? '__none__'}
                        onValueChange={(value) =>
                          onSetModelThinkingDefault(modelName, value === '__none__' ? null : (value as ThinkingLevel))
                        }
                        disabled={supportedLevels.length === 0}
                      >
                        <SelectTrigger className="h-8 rounded-lg bg-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('providerModelThinkingDefaultNone')}</SelectItem>
                          {supportedLevels.map((level) => (
                            <SelectItem key={level} value={level}>
                              {formatThinkingLevelLabel(level)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {supportedLevels.length === 0 ? (
                        <p className="text-xs text-gray-500">{t('providerModelThinkingNoSupported')}</p>
                      ) : null}
                    </div>
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  onClick={() => onRemoveModel(modelName)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 opacity-100 transition-opacity hover:bg-gray-100 hover:text-gray-600 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                  aria-label={t('remove')}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
