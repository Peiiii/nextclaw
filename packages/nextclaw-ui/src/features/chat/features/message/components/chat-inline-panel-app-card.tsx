import { useEffect, useId, useMemo, useRef } from 'react';
import type { ChatPanelAppCardViewModel } from '@nextclaw/agent-chat-ui';
import { AppWindow, Maximize2 } from 'lucide-react';
import { getPresenter } from '@/app/presenters/app.presenter';
import { findPanelAppEntryByDisplayId, usePanelApps } from '@/features/panel-apps';
import { createPanelAppRightPanelResourceTarget } from '@/features/right-panel-resources';
import {
  createInlinePanelAppCardUrl,
  createFallbackPanelAppContentPath,
  createInlinePanelAppTab,
  PANEL_APP_INLINE_CARD_MAX_HEIGHT_PX,
  PANEL_APP_INLINE_IFRAME_SANDBOX,
} from '@/features/chat/features/message/utils/chat-inline-panel-app-card.utils';
import { useDocBrowser } from '@/shared/components/doc-browser';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { t } from '@/shared/lib/i18n';

type ChatInlinePanelAppDescriptor = Pick<ChatPanelAppCardViewModel, 'appId' | 'title'>;

export function ChatInlinePanelAppCard({
  panelApp,
  showExpandAction = true,
}: {
  panelApp: ChatInlinePanelAppDescriptor;
  showExpandAction?: boolean;
}) {
  const docBrowser = useDocBrowser();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeId = useId();
  const panelApps = usePanelApps();
  const entry = useMemo(
    () => findPanelAppEntryByDisplayId(panelApps.data?.entries ?? [], panelApp.appId),
    [panelApp.appId, panelApps.data?.entries],
  );
  const target = entry ? createPanelAppRightPanelResourceTarget(entry) : null;
  const title = panelApp.title ?? target?.title ?? panelApp.appId;
  const url = panelApps.isLoading
    ? ''
    : target?.url ?? createFallbackPanelAppContentPath(panelApp.appId);
  const cardUrl = useMemo(
    () => (url ? createInlinePanelAppCardUrl(url) : ''),
    [url],
  );
  const tab = useMemo(
    () => createInlinePanelAppTab({
      appId: entry?.id ?? panelApp.appId,
      title,
      url,
    }),
    [entry?.id, panelApp.appId, title, url],
  );
  const iframeInstanceId = `${tab.id}:${tab.navVersion}:${iframeId}`;
  const openExpanded = () => {
    if (target) {
      docBrowser.openTarget(target);
      return;
    }
    docBrowser.open(url, {
      dedupeKey: tab.dedupeKey,
      kind: tab.kind,
      title,
    });
  };

  useEffect(() => {
    if (!url) {
      return undefined;
    }
    const handleMessage = (event: MessageEvent) => {
      getPresenter().panelAppBridgeManager.handleIframeMessage({
        event,
        iframe: iframeRef.current,
        iframeInstanceId,
        tab,
      });
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeInstanceId, tab, url]);

  if (!url) {
    return (
      <div
        className="h-[320px] min-h-[220px] w-full animate-pulse rounded-lg border border-border bg-muted/45"
        style={{ maxHeight: PANEL_APP_INLINE_CARD_MAX_HEIGHT_PX }}
      />
    );
  }

  return (
    <div className="w-full max-w-[42rem] overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex h-9 items-center justify-between gap-2 border-b border-border bg-muted/45 px-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
          <AppWindow className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{title}</span>
        </div>
        {showExpandAction ? (
          <IconActionButton
            className="h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            icon={<Maximize2 className="h-3.5 w-3.5" />}
            label={t('chatPanelCardExpand')}
            onClick={openExpanded}
          />
        ) : null}
      </div>
      <div
        className="relative h-[420px] min-h-[220px] max-h-[min(60vh,420px)] overflow-hidden bg-card"
      >
        <iframe
          ref={iframeRef}
          key={iframeInstanceId}
          src={cardUrl}
          title={title}
          sandbox={PANEL_APP_INLINE_IFRAME_SANDBOX}
          scrolling="auto"
          className="h-full w-full border-0 bg-card"
        />
      </div>
    </div>
  );
}
