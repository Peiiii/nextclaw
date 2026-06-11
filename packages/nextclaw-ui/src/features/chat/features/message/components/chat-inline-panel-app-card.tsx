import { useEffect, useId, useMemo, useRef } from 'react';
import type { ChatPanelAppCardViewModel } from '@nextclaw/agent-chat-ui';
import { getPresenter } from '@/app/presenters/app.presenter';
import { findPanelAppEntryByDisplayId, usePanelApps } from '@/features/panel-apps';
import { createPanelAppRightPanelResourceTarget } from '@/features/right-panel-resources';
import {
  createFallbackPanelAppContentPath,
  createInlinePanelAppTab,
  PANEL_APP_INLINE_IFRAME_SANDBOX,
} from '@/features/chat/features/message/utils/chat-inline-panel-app-card.utils';

export function ChatInlinePanelAppCard({
  panelApp,
}: {
  panelApp: ChatPanelAppCardViewModel;
}) {
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
  const tab = useMemo(
    () => createInlinePanelAppTab({
      appId: entry?.id ?? panelApp.appId,
      title,
      url,
    }),
    [entry?.id, panelApp.appId, title, url],
  );
  const iframeInstanceId = `${tab.id}:${tab.navVersion}:${iframeId}`;

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
      <div className="h-64 w-full animate-pulse bg-gradient-to-b from-white to-amber-50/60" />
    );
  }

  return (
    <div className="h-[320px] max-h-[45vh] min-h-[220px] w-full overflow-hidden bg-white">
      <iframe
        ref={iframeRef}
        key={iframeInstanceId}
        src={url}
        title={title}
        sandbox={PANEL_APP_INLINE_IFRAME_SANDBOX}
        className="h-full w-full border-0 bg-white"
      />
    </div>
  );
}
