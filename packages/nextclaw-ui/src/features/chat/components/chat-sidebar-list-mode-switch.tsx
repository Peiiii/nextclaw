import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

type ChatSidebarListModeSwitchProps = { isProjectFirstView: boolean; onSelectMode: (mode: 'time-first' | 'project-first') => void };

export function ChatSidebarListModeSwitch({ isProjectFirstView, onSelectMode }: ChatSidebarListModeSwitchProps) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <button
        type="button"
        aria-pressed={!isProjectFirstView}
        onClick={() => onSelectMode('time-first')}
        className={cn('rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border', isProjectFirstView ? 'text-muted-foreground/65 hover:text-muted-foreground' : 'font-medium text-foreground')}
      >
        {t('chatSidebarViewTime')}
      </button>
      <span className="text-muted-foreground/35">/</span>
      <button
        type="button"
        aria-pressed={isProjectFirstView}
        onClick={() => onSelectMode('project-first')}
        className={cn('rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border', isProjectFirstView ? 'font-medium text-foreground' : 'text-muted-foreground/65 hover:text-muted-foreground')}
      >
        {t('chatSidebarViewProject')}
      </button>
    </div>
  );
}
