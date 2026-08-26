import { useLayoutEffect } from "react";
import { ChatSidebar } from "@/features/chat/components/layout/chat-sidebar";
import { ChatConversationPanel } from "@/features/chat/components/conversation/chat-conversation-panel";
import { AgentsPage } from "@/features/agents";
import { CronConfig } from "@/features/cron";
import { MarketplacePage } from "@/features/marketplace";
import { useViewportLayout } from "@/app/hooks/use-viewport-layout";
import { ChatMobileShell } from "@/platforms/mobile";
import { InboxPage } from "@/features/inbox";
import { PanelAppMainPage } from "@/features/panel-apps";
import { useScrollRestoration } from "@/shared/hooks/use-scroll-restoration";
export type MainPanelView = "chat" | "cron" | "skills" | "agents" | "inbox" | "panel-app";
export type ChatPageProps = {
  view: MainPanelView;
};
const MANAGEMENT_PAGE_CANVAS_WIDTH_CLASS = "max-w-[min(1180px,100%)]";
type UseChatSessionSyncParams = {
  routeSessionKey: string | null;
  syncRouteSessionSelection: (routeSessionKey: string | null) => void;
};
export function useChatSessionSync(params: UseChatSessionSyncParams): void {
  const {
    routeSessionKey,
    syncRouteSessionSelection,
  } = params;

  useLayoutEffect(() => {
    syncRouteSessionSelection(routeSessionKey);
  }, [
    routeSessionKey,
    syncRouteSessionSelection,
  ]);
}
type ChatPageLayoutProps = {
  view: MainPanelView;
  confirmDialog: JSX.Element;
};
export function ChatPageLayout({ view, confirmDialog }: ChatPageLayoutProps) {
  const { isMobile } = useViewportLayout();
  const cronScroll = useScrollRestoration<HTMLDivElement>({
    restorationKey: "main-page:cron",
  });
  const agentsScroll = useScrollRestoration<HTMLDivElement>({
    restorationKey: "main-page:agents",
  });
  const { onScroll: onCronScroll, scrollRef: cronScrollRef } = cronScroll;
  const { onScroll: onAgentsScroll, scrollRef: agentsScrollRef } = agentsScroll;

  return (
    <div className="h-full flex">
      {!isMobile ? <ChatSidebar /> : null}

      {view === "chat" ? (
        isMobile ? <ChatMobileShell /> : <ChatConversationPanel />
      ) : (
        <section className="flex-1 min-h-0 overflow-hidden bg-background">
          {view === "inbox" ? (
            <div className={`mx-auto flex h-full min-h-0 w-full flex-col py-4 sm:px-6 sm:py-5 ${MANAGEMENT_PAGE_CANVAS_WIDTH_CLASS}`}>
              <InboxPage />
            </div>
          ) : view === "panel-app" ? (
            <PanelAppMainPage />
          ) : view === "cron" ? (
            <div
              ref={cronScrollRef}
              onScroll={onCronScroll}
              className="h-full overflow-auto custom-scrollbar"
            >
              <div className={`mx-auto w-full px-4 py-4 sm:px-6 sm:py-5 ${MANAGEMENT_PAGE_CANVAS_WIDTH_CLASS}`}>
                <CronConfig />
              </div>
            </div>
          ) : view === "agents" ? (
            <div
              ref={agentsScrollRef}
              onScroll={onAgentsScroll}
              className="h-full overflow-auto custom-scrollbar"
            >
              <div className={`mx-auto w-full px-4 py-4 sm:px-6 sm:py-5 ${MANAGEMENT_PAGE_CANVAS_WIDTH_CLASS}`}>
                <AgentsPage />
              </div>
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              <div className={`mx-auto flex h-full min-h-0 w-full flex-col px-4 py-4 sm:px-6 sm:py-5 ${MANAGEMENT_PAGE_CANVAS_WIDTH_CLASS}`}>
                <MarketplacePage forcedType="skills" />
              </div>
            </div>
          )}
        </section>
      )}
      {confirmDialog}
    </div>
  );
}
