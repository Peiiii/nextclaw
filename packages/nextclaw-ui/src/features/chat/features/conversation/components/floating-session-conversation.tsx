import { sessionSurfaceManager } from '@/features/chat/managers/session-surface.manager';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, Maximize2, MessageSquare, Minus, PanelRight, X } from 'lucide-react';
import { getAppPresenter } from '@/app/presenters/app.presenter';
import { useNavigate } from 'react-router-dom';
import { SessionConversationArea } from './session-conversation-area';
import { useFloatingSessionStore } from '@/features/chat/stores/floating-session.store';
import { buildSessionPath } from '@/features/chat/features/session/utils/chat-session-route.utils';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

export function FloatingSessionConversation() {
  const { session, minimized } = useFloatingSessionStore();
  const { minimize, restore, close } = sessionSurfaceManager;
  const navigate = useNavigate();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (session?.sessionKey) panelRef.current?.focus();
  }, [session?.sessionKey]);
  if (!session) return null;

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      role="region"
      aria-label={t('chatFloatingConversation')}
      data-theme-surface="workspace"
      data-testid="floating-session-conversation"
      className={cn(
        'fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl outline-none',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
        minimized ? 'w-80' : 'h-[min(720px,calc(100dvh-5rem))] w-[560px]',
      )}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented && !minimized) {
          event.stopPropagation();
          minimize();
          toggleRef.current?.focus();
        }
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={session.title}>
          {session.title}
        </span>
        <IconActionButton
          ref={toggleRef}
          icon={minimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          label={t(minimized ? 'chatFloatingRestore' : 'chatFloatingMinimize')}
          onClick={minimized ? restore : minimize}
        />
        <IconActionButton
          icon={<PanelRight className="h-4 w-4" />}
          label={t('chatPanelDock')}
          onClick={() => sessionSurfaceManager.dock(session, getAppPresenter().docBrowserManager)}
        />
        <IconActionButton
          icon={<ArrowUpRight className="h-4 w-4" />}
          label={t('chatFloatingOpenMain')}
          onClick={() => {
            navigate(buildSessionPath(session.sessionKey));
            close();
          }}
        />
        <IconActionButton
          icon={<X className="h-4 w-4" />}
          label={t('chatFloatingClose')}
          onClick={close}
        />
      </header>
      <div hidden={minimized} className={cn('min-h-0 flex-1 flex-col', minimized ? 'hidden' : 'flex')}>
        <SessionConversationArea key={session.sessionKey} sessionKey={session.sessionKey} />
      </div>
    </section>
  );
}
