import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SkillsPicker } from '@/components/chat/SkillsPicker';
import type { MarketplaceInstalledRecord } from '@/api/types';
import { t } from '@/lib/i18n';
import { Paperclip, Send, Sparkles, Square, X } from 'lucide-react';

export type ChatModelOption = {
  value: string;
  modelLabel: string;
  providerLabel: string;
};

type ChatInputBarProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
  canStopGeneration: boolean;
  stopDisabledReason?: string | null;
  sendError?: string | null;
  isSending: boolean;
  queuedCount: number;
  modelOptions: ChatModelOption[];
  selectedModel: string;
  onSelectedModelChange: (value: string) => void;
  skillRecords: MarketplaceInstalledRecord[];
  isSkillsLoading?: boolean;
  selectedSkills: string[];
  onSelectedSkillsChange: (next: string[]) => void;
};

export function ChatInputBar({
  draft,
  onDraftChange,
  onSend,
  onStop,
  canStopGeneration,
  stopDisabledReason = null,
  sendError = null,
  isSending,
  queuedCount,
  modelOptions,
  selectedModel,
  onSelectedModelChange,
  skillRecords,
  isSkillsLoading = false,
  selectedSkills,
  onSelectedSkillsChange
}: ChatInputBarProps) {
  const selectedModelOption = modelOptions.find((option) => option.value === selectedModel);
  const resolvedStopHint =
    stopDisabledReason === '__preparing__'
      ? t('chatStopPreparing')
      : stopDisabledReason?.trim() || t('chatStopUnavailable');
  const selectedSkillRecords = selectedSkills.map((spec) => {
    const matched = skillRecords.find((record) => record.spec === spec);
    return {
      spec,
      label: matched?.label || spec
    };
  });

  return (
    <div className="border-t border-gray-200/80 bg-white p-4">
      <div className="mx-auto w-full max-w-[min(1120px,100%)]">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-card overflow-hidden">
          {/* Textarea */}
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && isSending && canStopGeneration) {
                e.preventDefault();
                void onStop();
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            placeholder={t('chatInputPlaceholder')}
            className="w-full min-h-[68px] max-h-[220px] resize-y bg-transparent outline-none text-sm px-4 py-3 text-gray-800 placeholder:text-gray-400"
          />
          {selectedSkillRecords.length > 0 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                {selectedSkillRecords.map((record) => (
                  <button
                    key={record.spec}
                    type="button"
                    onClick={() => onSelectedSkillsChange(selectedSkills.filter((skill) => skill !== record.spec))}
                    className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    <span className="truncate">{record.label}</span>
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left group */}
            <div className="flex items-center gap-1">
              {/* Skills picker */}
              <SkillsPicker
                records={skillRecords}
                isLoading={isSkillsLoading}
                selectedSkills={selectedSkills}
                onSelectedSkillsChange={onSelectedSkillsChange}
              />

              {/* Model selector */}
              <Select
                value={modelOptions.length > 0 ? selectedModel : undefined}
                onValueChange={onSelectedModelChange}
                disabled={modelOptions.length === 0}
              >
                <SelectTrigger className="h-8 w-auto min-w-[220px] rounded-lg border-0 bg-transparent shadow-none text-xs font-medium text-gray-600 hover:bg-gray-100 focus:ring-0 px-3">
                  {selectedModelOption ? (
                    <div className="flex min-w-0 items-center gap-2 text-left">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate text-xs font-semibold text-gray-700">
                        {selectedModelOption.providerLabel}/{selectedModelOption.modelLabel}
                      </span>
                    </div>
                  ) : (
                    <SelectValue placeholder={t('chatSelectModel')} />
                  )}
                </SelectTrigger>
                <SelectContent className="w-[320px]">
                  {modelOptions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-500">{t('chatModelNoOptions')}</div>
                  )}
                  {modelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="py-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-xs font-semibold text-gray-800">{option.modelLabel}</span>
                        <span className="truncate text-[11px] text-gray-500">{option.providerLabel}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Attachment button (placeholder) */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 cursor-not-allowed"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">{t('chatInputAttachComingSoon')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Right group */}
            <div className="flex flex-col items-end gap-1">
              {sendError?.trim() && (
                <div className="max-w-[420px] text-right text-[11px] text-red-600">{sendError}</div>
              )}
              <div className="flex items-center gap-2">
              {isSending && queuedCount > 0 && (
                <span className="text-[11px] text-gray-400">
                  {t('chatQueuedHintPrefix')} {queuedCount} {t('chatQueuedHintSuffix')}
                </span>
              )}
              {isSending ? (
                canStopGeneration ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-lg"
                    onClick={() => void onStop()}
                  >
                    <Square className="h-3.5 w-3.5 mr-1.5" />
                    {t('chatStop')}
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button size="sm" className="rounded-lg" disabled>
                            <Square className="h-3.5 w-3.5 mr-1.5" />
                            {t('chatStop')}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">{resolvedStopHint}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              ) : (
                <Button
                  size="sm"
                  className="rounded-lg"
                  onClick={() => void onSend()}
                  disabled={draft.trim().length === 0}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {t('chatSend')}
                </Button>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
