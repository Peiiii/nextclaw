import type { SessionEntryView } from '@/api/types';
import { SessionContextIconNode } from '@/components/common/session-context-icon';
import { SessionRunBadge } from '@/components/common/SessionRunBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type SessionContextView } from '@/lib/session-context.utils';
import type { SessionRunStatus } from '@/lib/session-run-status';
import { cn } from '@/lib/utils';
import { formatDateTime, t } from '@/lib/i18n';
import { Check, Pencil, X } from 'lucide-react';

type ChatSidebarSessionItemProps = {
  session: SessionEntryView;
  active: boolean;
  runStatus?: SessionRunStatus;
  context: SessionContextView;
  title: string;
  isEditing: boolean;
  draftLabel: string;
  isSaving: boolean;
  onSelect: () => void;
  onStartEditing: () => void;
  onDraftLabelChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
};

export function ChatSidebarSessionItem(props: ChatSidebarSessionItemProps) {
  const {
    session,
    active,
    runStatus,
    context,
    title,
    isEditing,
    draftLabel,
    isSaving,
    onSelect,
    onStartEditing,
    onDraftLabelChange,
    onSave,
    onCancel
  } = props;

  const iconTone = active ? 'text-gray-700' : 'text-gray-500';

  return (
    <div
      className={cn(
        'w-full rounded-xl px-3 py-2 text-left transition-all text-[13px]',
        active
          ? 'bg-gray-200 text-gray-900 font-semibold shadow-sm'
          : 'text-gray-700 hover:bg-gray-200/60 hover:text-gray-900'
      )}
    >
      {isEditing ? (
        <div className="space-y-2">
          <Input
            value={draftLabel}
            onChange={(event) => onDraftLabelChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void onSave();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
              }
            }}
            placeholder={t('sessionsLabelPlaceholder')}
            className="h-8 rounded-lg border-gray-300 bg-white text-xs"
            autoFocus
            disabled={isSaving}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-[11px] text-gray-400 truncate">{session.key}</div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-gray-500 hover:bg-white hover:text-gray-900"
                onClick={() => void onSave()}
                disabled={isSaving}
                aria-label={t('save')}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-gray-500 hover:bg-white hover:text-gray-900"
                onClick={onCancel}
                disabled={isSaving}
                aria-label={t('cancel')}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="group/session relative">
          <button type="button" onClick={onSelect} className="w-full text-left">
            <div className="grid grid-cols-[minmax(0,1fr)_0.875rem] items-center gap-1.5 pr-8">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium">{title}</span>
                {context.label ? (
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                      active
                        ? 'border-gray-300 bg-white/80 text-gray-700'
                        : 'border-gray-200 bg-gray-100 text-gray-500'
                    )}
                  >
                    {context.label}
                  </span>
                ) : null}
                {context.icon ? (
                  <span className="inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center">
                    <SessionContextIconNode icon={context.icon} className={iconTone} />
                  </span>
                ) : null}
              </span>
              <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {runStatus ? <SessionRunBadge status={runStatus} /> : null}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-gray-400 truncate">
              {session.messageCount} · {formatDateTime(session.updatedAt)}
            </div>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onStartEditing();
            }}
            className={cn(
              'absolute right-0 top-0 inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-white hover:text-gray-900',
              active
                ? 'opacity-100'
                : 'opacity-0 group-hover/session:opacity-100 group-focus-within/session:opacity-100'
            )}
            aria-label={t('edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
