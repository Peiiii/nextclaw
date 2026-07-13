import { useState } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import { SessionContextIconNode } from '@/features/chat/features/session/components/session-context-icon';
import { ChatSessionTypeOptionItem } from '@/features/chat/features/session-type/components/chat-session-type-option-item';
import type { ChatSessionTypeOption } from '@/features/chat/features/session-type/utils/chat-session-type.utils';
import {
  Popover,
  PopoverTrigger,
  createPopoverAvailableHeightLimit,
} from '@/shared/components/ui/popover';
import { ChatPopoverContent } from '@/features/chat/components/chat-popover-content';
import { t } from '@/shared/lib/i18n';

type SessionTypeOption = ChatSessionTypeOption;

type ChatWelcomeSessionTypePickerProps = {
  options: readonly SessionTypeOption[];
  selectedSessionType: string;
  onSelectSessionType: (sessionType: string) => void;
};

const SESSION_TYPE_PICKER_MAX_HEIGHT = createPopoverAvailableHeightLimit('18rem');

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
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
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
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        </button>
      </PopoverTrigger>
      <ChatPopoverContent
        align="start"
        className="flex w-[min(16rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
        style={{ maxHeight: SESSION_TYPE_PICKER_MAX_HEIGHT }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
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
      </ChatPopoverContent>
    </Popover>
  );
}
