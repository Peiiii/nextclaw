import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type ChatSidebarListModeSwitchProps = { isProjectFirstView: boolean; onSelectMode: (mode: 'time-first' | 'project-first') => void };

export function ChatSidebarListModeSwitch({ isProjectFirstView, onSelectMode }: ChatSidebarListModeSwitchProps) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <button
        type="button"
        aria-pressed={!isProjectFirstView}
        onClick={() => onSelectMode('time-first')}
        className={cn('transition-colors', isProjectFirstView ? 'text-gray-400 hover:text-gray-600' : 'font-medium text-gray-600')}
      >
        {t('chatSidebarViewTime')}
      </button>
      <span className="text-gray-300">/</span>
      <button
        type="button"
        aria-pressed={isProjectFirstView}
        onClick={() => onSelectMode('project-first')}
        className={cn('transition-colors', isProjectFirstView ? 'font-medium text-gray-600' : 'text-gray-400 hover:text-gray-600')}
      >
        {t('chatSidebarViewProject')}
      </button>
    </div>
  );
}
