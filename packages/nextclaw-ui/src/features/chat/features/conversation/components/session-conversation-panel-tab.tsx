import { Maximize2, MessageSquare } from 'lucide-react';
import { useAppPresenter } from '@/app/components/app-presenter-provider';
import { sessionSurfaceManager } from '@/features/chat/managers/session-surface.manager';
import { CHAT_SESSION_PANEL_KIND, parseSessionKeyFromPanelUrl } from '@/features/chat/features/session/utils/chat-session-route.utils';
import { SessionConversationArea } from './session-conversation-area';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import type { DocBrowserCustomTabRenderers } from '@/shared/components/doc-browser/doc-browser-renderer.types';
import type { DocBrowserTab } from '@/shared/components/doc-browser/types/doc-browser.types';
import { t } from '@/shared/lib/i18n';

function SessionPanelToolbar({ tab }: { tab: DocBrowserTab }) {
  const presenter = useAppPresenter();
  return <IconActionButton
    icon={<Maximize2 className="h-4 w-4" />}
    label={t('chatFloatingExpand')}
    onClick={() => sessionSurfaceManager.popOut(tab, presenter.docBrowserManager)}
  />;
}

function SessionPanelContent({ tab }: { tab: DocBrowserTab }) {
  const sessionKey = parseSessionKeyFromPanelUrl(tab.currentUrl);
  return (
    <div data-testid="session-conversation-panel-tab" className="flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground">
      {sessionKey
        ? <SessionConversationArea key={sessionKey} sessionKey={sessionKey} />
        : <p role="status" className="p-4 text-sm text-muted-foreground">{t('chatPanelUnavailable')}</p>}
    </div>
  );
}

export const CHAT_SESSION_PANEL_RENDERERS: DocBrowserCustomTabRenderers = {
  [CHAT_SESSION_PANEL_KIND]: {
    getTitle: (tab) => tab.title,
    renderIcon: () => <MessageSquare className="h-4 w-4" />,
    renderToolbar: ({ tab }) => <SessionPanelToolbar tab={tab} />,
    renderContent: ({ tab }) => <SessionPanelContent tab={tab} />,
  },
};
