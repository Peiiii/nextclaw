import { AlarmClock, Clock3, Folder } from 'lucide-react';
import type { ChatSessionListMode } from '@/features/chat/stores/chat-session-list.store';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

type ChatSidebarListModeSwitchProps = { listMode: ChatSessionListMode; onSelectMode: (mode: ChatSessionListMode) => void };

const modes = [
  { value: 'time-first', icon: Clock3, label: 'chatSidebarViewTime' },
  { value: 'project-first', icon: Folder, label: 'chatSidebarViewProject' },
  { value: 'scheduled', icon: AlarmClock, label: 'chatSidebarViewScheduled' },
] as const;

export function ChatSidebarListModeSwitch({ listMode, onSelectMode }: ChatSidebarListModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label={t('chatSidebarViewMode')}
      className="inline-flex h-7 shrink-0 rounded-full bg-foreground/[0.04] p-0.5 text-[11px]"
    >
      {modes.map(({ value, icon: Icon, label }) => (
        <button key={value} type="button" aria-pressed={listMode === value} onClick={() => onSelectMode(value)}
          className={cn(
            'inline-flex h-6 items-center justify-center gap-0.5 whitespace-nowrap rounded-full px-1 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            listMode === value
              ? 'bg-[var(--sidebar-segment-selection)] font-medium text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}>
          <Icon aria-hidden="true" className="h-3 w-3" />{t(label)}
        </button>
      ))}
    </div>
  );
}
