import { useState } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import { SessionContextIconNode } from '@/features/chat/features/session/components/session-context-icon';
import { ChatSessionTypeOptionItem } from '@/features/chat/features/session-type/components/chat-session-type-option-item';
import type { ChatInputSnapshot } from '@/features/chat/stores/chat-input.store';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { t } from '@/shared/lib/i18n';

type SessionTypeOption = ChatInputSnapshot['sessionTypeOptions'][number];

type ChatWelcomeSessionTypePickerProps = {
  options: readonly SessionTypeOption[];
  selectedSessionType: string;
  onSelectSessionType: (sessionType: string) => void;
};

export function ChatWelcomeSessionTypePicker({
  options,
  selectedSessionType,
  onSelectSessionType,
}: ChatWelcomeSessionTypePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.value === selectedSessionType) ?? options[0] ?? null;

  if (!selectedOption) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          aria-label={t('chatWelcomeSessionTypePickerLabel')}
        >
          {selectedOption.icon?.src ? (
            <SessionContextIconNode
              icon={{
                kind: 'runtime-image',
                src: selectedOption.icon.src,
                alt: selectedOption.icon.alt ?? null,
                name: selectedOption.label,
              }}
              className="h-4 w-4"
            />
          ) : (
            <Bot className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{selectedOption.label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 rounded-2xl border border-gray-200/80 bg-white p-1.5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
      >
        <div className="max-h-72 overflow-y-auto">
          {options.map((option) => (
            <ChatSessionTypeOptionItem
              key={option.value}
              option={option}
              onSelect={() => {
                onSelectSessionType(option.value);
                setIsOpen(false);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
