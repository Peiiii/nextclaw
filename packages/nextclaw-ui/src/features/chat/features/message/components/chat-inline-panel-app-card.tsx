import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChatPanelAppCardViewModel } from "@nextclaw/agent-chat-ui";
import { Maximize2 } from "lucide-react";
import { getPresenter } from "@/app/presenters/app.presenter";
import {
  PANEL_APP_IFRAME_SANDBOX,
  findPanelAppEntryByDisplayId,
  focusPanelAppIframe,
  usePanelApps,
} from "@/features/panel-apps";
import { createPanelAppRightPanelResourceTarget } from "@/features/right-panel-resources";
import {
  createInlinePanelAppCardUrl,
  createFallbackPanelAppContentPath,
  createInlinePanelAppTab,
  readInlinePanelAppContentHeight,
} from "@/features/chat/features/message/utils/chat-inline-panel-app-card.utils";
import { ChatInlineContentSurface } from "@/features/chat/features/message/components/chat-inline-content-surface";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { t } from "@/shared/lib/i18n";

type ChatInlinePanelAppDescriptor = Pick<
  ChatPanelAppCardViewModel,
  "appId" | "title"
>;

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
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const panelApps = usePanelApps();
  const entry = useMemo(
    () =>
      findPanelAppEntryByDisplayId(
        panelApps.data?.entries ?? [],
        panelApp.appId,
      ),
    [panelApp.appId, panelApps.data?.entries],
  );
  const target = entry ? createPanelAppRightPanelResourceTarget(entry) : null;
  const title = panelApp.title ?? target?.title ?? panelApp.appId;
  const url = panelApps.isLoading
    ? ""
    : (target?.url ?? createFallbackPanelAppContentPath(panelApp.appId));
  const cardUrl = useMemo(
    () => (url ? createInlinePanelAppCardUrl(url) : ""),
    [url],
  );
  const tab = useMemo(
    () =>
      createInlinePanelAppTab({
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
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const nextContentHeight = readInlinePanelAppContentHeight(event.data);
      if (nextContentHeight !== null) {
        setContentHeight(nextContentHeight);
        return;
      }
      getPresenter().panelAppBridgeManager.handleIframeMessage({
        event,
        iframe: iframeRef.current,
        iframeInstanceId,
        tab,
      });
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [iframeInstanceId, tab, url]);

  if (!url) {
    return (
      <ChatInlineContentSurface isLoading>
        <span className="sr-only">{title}</span>
      </ChatInlineContentSurface>
    );
  }

  return (
    <ChatInlineContentSurface
      actions={
        showExpandAction ? (
          <IconActionButton
            size="sm"
            icon={<Maximize2 className="h-3.5 w-3.5" />}
            label={t("chatPanelCardExpand")}
            tooltipSide="top"
            onClick={openExpanded}
          />
        ) : undefined
      }
      contentHeight={contentHeight}
    >
      <iframe
        ref={iframeRef}
        key={iframeInstanceId}
        src={cardUrl}
        title={title}
        sandbox={PANEL_APP_IFRAME_SANDBOX}
        tabIndex={0}
        onPointerOver={() => focusPanelAppIframe(iframeRef.current)}
        className="h-full w-full border-0 bg-card"
      />
    </ChatInlineContentSurface>
  );
}
