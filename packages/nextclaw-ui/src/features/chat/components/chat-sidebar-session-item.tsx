import { AgentAvatar } from '@/shared/components/common/agent-avatar';
import { SessionContextIconNode } from '@/features/chat/components/session/session-context-icon';
import { SessionRunBadge } from '@/features/chat/components/session/session-run-badge';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Input } from '@/shared/components/ui/input';
import { type SessionContextView } from '@/features/chat/utils/session-context.utils';
import type { SessionRunStatus } from '@/features/chat/types/session-run-status.types';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';
import { Check, GitBranch, Pencil, X } from 'lucide-react';

type ChatSidebarSessionItemProps = {
  sessionKey: string;
  active: boolean;
  showUnreadDot: boolean;
  runStatus?: SessionRunStatus;
  context: SessionContextView;
  title: string;
  previewText: string;
  trailingText: string;
  agentId?: string | null;
  agentLabel?: string | null;
  agentAvatarUrl?: string | null;
  childSessionCount?: number;
  isEditing: boolean;
  draftLabel: string;
  isSaving: boolean;
  onSelect: () => void;
  onOpenChildSessions?: () => void;
  onStartEditing: () => void;
  onDraftLabelChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
};

type ChatSidebarSessionEditingViewProps = Pick<
  ChatSidebarSessionItemProps,
  'sessionKey' | 'draftLabel' | 'isSaving' | 'onDraftLabelChange' | 'onSave' | 'onCancel'
>;

function ChatSidebarSessionEditingView({
  sessionKey,
  draftLabel,
  isSaving,
  onDraftLabelChange,
  onSave,
  onCancel
}: ChatSidebarSessionEditingViewProps) {
  return (
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
        <div className="min-w-0 text-[11px] text-gray-400 truncate">{sessionKey}</div>
        <div className="flex items-center gap-1">
          <IconActionButton
            icon={<Check className="h-3.5 w-3.5" />}
            label={t('save')}
            tooltip=""
            className="h-7 w-7 rounded-lg text-gray-500 hover:bg-white hover:text-gray-900"
            onClick={() => void onSave()}
            disabled={isSaving}
          />
          <IconActionButton
            icon={<X className="h-3.5 w-3.5" />}
            label={t('cancel')}
            tooltip=""
            className="h-7 w-7 rounded-lg text-gray-500 hover:bg-white hover:text-gray-900"
            onClick={onCancel}
            disabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

type ChatSidebarSessionDisplayViewProps = Omit<
  ChatSidebarSessionItemProps,
  'sessionKey' | 'isEditing' | 'draftLabel' | 'isSaving' | 'onDraftLabelChange' | 'onSave' | 'onCancel'
>;

function ChatSidebarSessionDisplayView({
  active,
  showUnreadDot,
  runStatus,
  context,
  title,
  previewText,
  trailingText,
  agentId,
  agentLabel,
  agentAvatarUrl,
  childSessionCount = 0,
  onSelect,
  onOpenChildSessions,
  onStartEditing
}: ChatSidebarSessionDisplayViewProps) {
  const trailingControlsClassName = childSessionCount > 0 && onOpenChildSessions ? 'pr-14' : 'pr-6';

  return (
    <div className="group/session relative">
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className={cn('flex min-w-0 items-start', trailingControlsClassName)}>
          <span className="flex min-w-0 items-center gap-1.5">
            {agentId?.trim() && agentId.trim().toLowerCase() !== 'main' ? (
              <AgentAvatar
                agentId={agentId}
                displayName={agentLabel}
                avatarUrl={agentAvatarUrl}
                className="h-5 w-5 shrink-0"
              />
            ) : null}
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
                <SessionContextIconNode icon={context.icon} className={active ? 'text-gray-700' : 'text-gray-500'} />
              </span>
            ) : null}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
          <span className="min-w-0 truncate">
            {previewText}
          </span>
          {showUnreadDot ? (
            <span
              aria-label={t('chatSessionUnread')}
              className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary"
            />
          ) : (
            <span className="ml-auto shrink-0">{trailingText}</span>
          )}
        </div>
      </button>
      {childSessionCount > 0 && onOpenChildSessions ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenChildSessions();
          }}
          className={cn(
            'absolute right-6 top-0 inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-gray-400 transition-all hover:bg-white hover:text-gray-900',
            active
              ? 'opacity-100'
              : 'opacity-0 group-hover/session:opacity-100 group-focus-within/session:opacity-100'
          )}
          aria-label={t('chatSessionOpenChildSessions')}
          title={t('chatSessionOpenChildSessions')}
        >
          <GitBranch className="h-3.5 w-3.5" />
          <span>{childSessionCount}</span>
        </button>
      ) : null}
      {runStatus ? (
        <span className="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center transition-opacity group-hover/session:opacity-0 group-focus-within/session:opacity-0">
          <SessionRunBadge status={runStatus} />
        </span>
      ) : null}
      <IconActionButton
        icon={<Pencil className="h-3 w-3" />}
        label={t('edit')}
        tooltip=""
        onClick={(event) => {
          event.stopPropagation();
          onStartEditing();
        }}
        className={cn(
          'absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-md text-gray-400 transition-all hover:bg-white hover:text-gray-900',
          'opacity-0 group-hover/session:opacity-100 group-focus-within/session:opacity-100'
        )}
      />
    </div>
  );
}

export function ChatSidebarSessionItem({
  sessionKey,
  active,
  showUnreadDot,
  runStatus,
  context,
  title,
  previewText,
  trailingText,
  agentId,
  agentLabel,
  agentAvatarUrl,
  childSessionCount,
  isEditing,
  draftLabel,
  isSaving,
  onSelect,
  onOpenChildSessions,
  onStartEditing,
  onDraftLabelChange,
  onSave,
  onCancel
}: ChatSidebarSessionItemProps) {
  return (
    <div
      className={cn(
        'w-full rounded-xl px-3 py-2.5 text-left transition-all text-[13px]',
        active
          ? 'bg-gray-200 text-gray-900 font-semibold shadow-sm'
          : 'text-gray-700 hover:bg-gray-200/60 hover:text-gray-900'
      )}
    >
      {isEditing ? (
        <ChatSidebarSessionEditingView
          sessionKey={sessionKey}
          draftLabel={draftLabel}
          isSaving={isSaving}
          onDraftLabelChange={onDraftLabelChange}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : (
        <ChatSidebarSessionDisplayView
          active={active}
          showUnreadDot={showUnreadDot}
          runStatus={runStatus}
          context={context}
          title={title}
          previewText={previewText}
          trailingText={trailingText}
          agentId={agentId}
          agentLabel={agentLabel}
          agentAvatarUrl={agentAvatarUrl}
          onSelect={onSelect}
          childSessionCount={childSessionCount}
          onOpenChildSessions={onOpenChildSessions}
          onStartEditing={onStartEditing}
        />
      )}
    </div>
  );
}
