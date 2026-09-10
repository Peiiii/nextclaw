import { Pencil, Pin, Trash2 } from 'lucide-react';
import { AgentAvatar } from '@/shared/components/common/agent-avatar';
import { ChatSessionMoreActionsMenu } from '@/features/chat/features/session/components/session-header/chat-session-more-actions-menu';
import { ChatSessionHeaderMenuItem } from '@/features/chat/features/session/components/session-header/chat-session-header-menu-item';
import { SessionRunBadge } from './session-run-badge';
import type { ChatSidebarSessionItemProps } from './chat-sidebar-session-item';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

const SESSION_AVATAR_COLORS = [
  'bg-blue-100 text-blue-800 [html[data-theme-appearance=dark]_&]:bg-blue-950 [html[data-theme-appearance=dark]_&]:text-blue-200',
  'bg-emerald-100 text-emerald-800 [html[data-theme-appearance=dark]_&]:bg-emerald-950 [html[data-theme-appearance=dark]_&]:text-emerald-200',
  'bg-violet-100 text-violet-800 [html[data-theme-appearance=dark]_&]:bg-violet-950 [html[data-theme-appearance=dark]_&]:text-violet-200',
  'bg-amber-100 text-amber-800 [html[data-theme-appearance=dark]_&]:bg-amber-950 [html[data-theme-appearance=dark]_&]:text-amber-200',
  'bg-rose-100 text-rose-800 [html[data-theme-appearance=dark]_&]:bg-rose-950 [html[data-theme-appearance=dark]_&]:text-rose-200',
];

function sessionAvatarColor(sessionKey: string): string {
  let hash = 0;
  for (const character of sessionKey) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return SESSION_AVATAR_COLORS[Math.abs(hash) % SESSION_AVATAR_COLORS.length];
}

/** Mobile presentation of the same session entry and actions used by the sidebar. */
export function ChatMobileSessionRow(props: ChatSidebarSessionItemProps) {
  const { sessionKey, title, previewText, trailingText, agentId, agentLabel,
    agentAvatarUrl, showUnreadDot, runStatus, isPinned, onSelect,
    onStartEditing, onTogglePinned, onDelete } = props;
  return (
    <div className="relative flex min-w-0 items-center">
      <button type="button" onClick={onSelect} className="flex min-h-[76px] min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-1 text-left active:bg-muted">
        <span className="relative shrink-0">
          {agentAvatarUrl || (agentId && agentId.toLowerCase() !== 'main') ? (
            <AgentAvatar agentId={agentId || 'main'} displayName={agentLabel} avatarUrl={agentAvatarUrl} className="h-12 w-12 rounded-xl text-lg" />
          ) : (
            <span aria-hidden="true" className={cn('flex h-12 w-12 items-center justify-center rounded-xl text-base font-medium', sessionAvatarColor(sessionKey))}>
              {Array.from(title.trim()).slice(0, 2).join('')}
            </span>
          )}
          {showUnreadDot ? <span aria-label={t('chatSessionUnread')} className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[16px] font-medium leading-6 text-foreground">{title}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{trailingText}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            {runStatus ? <SessionRunBadge status={runStatus} /> : null}
            {isPinned ? <Pin aria-label={t('chatSidebarUnpinSession')} className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
            <span className="min-w-0 truncate text-[13px] leading-5 text-muted-foreground">{previewText}</span>
          </span>
        </span>
      </button>
      <ChatSessionMoreActionsMenu sessionKey={sessionKey} sessionTitle={title} className="h-11 w-9 shrink-0 rounded-none text-muted-foreground">
        <ChatSessionHeaderMenuItem icon={Pin} label={t(isPinned ? 'chatSidebarUnpinSession' : 'chatSidebarPinSession')} onClick={onTogglePinned} />
        <ChatSessionHeaderMenuItem icon={Pencil} label={t('edit')} onClick={onStartEditing} />
        <ChatSessionHeaderMenuItem icon={Trash2} label={t('delete')} onClick={onDelete} destructive />
      </ChatSessionMoreActionsMenu>
    </div>
  );
}
