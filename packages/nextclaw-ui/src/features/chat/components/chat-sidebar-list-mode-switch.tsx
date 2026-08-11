import { Clock3, Folder } from 'lucide-react';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

type ChatSidebarListModeSwitchProps = { isProjectFirstView: boolean; onSelectMode: (mode: 'time-first' | 'project-first') => void };

export function ChatSidebarListModeSwitch({ isProjectFirstView, onSelectMode }: ChatSidebarListModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label={t('chatSidebarViewMode')}
      className="relative grid h-7 grid-cols-2 rounded-full bg-foreground/[0.04] p-0.5 text-[11px]"
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-2px)] rounded-full bg-gray-200/70 transition-transform duration-200 ease-out motion-reduce:transition-none',
          isProjectFirstView && 'translate-x-full',
        )}
      />
      <button
        type="button"
        aria-pressed={!isProjectFirstView}
        onClick={() => onSelectMode('time-first')}
        className={cn(
          'relative z-10 inline-flex h-6 items-center justify-center gap-1 rounded-full px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          isProjectFirstView
            ? 'text-muted-foreground hover:text-foreground'
            : 'font-medium text-foreground',
        )}
      >
        <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
        {t('chatSidebarViewTime')}
      </button>
      <button
        type="button"
        aria-pressed={isProjectFirstView}
        onClick={() => onSelectMode('project-first')}
        className={cn(
          'relative z-10 inline-flex h-6 items-center justify-center gap-1 rounded-full px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          isProjectFirstView
            ? 'font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Folder aria-hidden="true" className="h-3.5 w-3.5" />
        {t('chatSidebarViewProject')}
      </button>
    </div>
  );
}
