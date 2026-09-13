import { ResourcePage } from '@/features/right-panel-resources';
import { lazy, Suspense, useLayoutEffect } from "react";
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
const ProjectsPage = lazy(async () => ({
  default: (await import("@/features/projects")).ProjectsPage,
}));

export type MainPanelView = "resource" | "chat" | "cron" | "skills" | "agents" | "inbox" | "panel-app" | "projects";
export type ChatPageProps = {
  view: MainPanelView;
};
const MANAGEMENT_PAGE_CANVAS_WIDTH_CLASS = "max-w-[min(1180px,100%)]";

function resolveManagementWorkspaceClass(view: MainPanelView): string {
  return view === "projects"
    ? "relative flex flex-1 min-h-0 overflow-hidden bg-background"
    : "flex-1 min-h-0 overflow-hidden bg-background";
}

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
  confirmDialog?: JSX.Element;
};
function ManagementPageContent({ view }: ChatPageProps) {
  const { onScroll, scrollRef } = useScrollRestoration<HTMLDivElement>({
    restorationKey: view === 'cron' || view === 'agents' ? `main-page:${view}` : null,
  });
  switch (view) {
    case 'resource': return <ResourcePage />;
    case 'projects': return <Suspense fallback={<div className="h-full animate-pulse bg-card/30" />}><ProjectsPage /></Suspense>;
    case 'panel-app': return <PanelAppMainPage />;
    case 'inbox': return <div className={`mx-auto flex h-full min-h-0 w-full flex-col py-4 sm:px-6 sm:py-5 ${MANAGEMENT_PAGE_CANVAS_WIDTH_CLASS}`}><InboxPage /></div>;
    case 'cron':
    case 'agents': return <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-auto custom-scrollbar">
      <div className={`mx-auto w-full px-4 py-4 sm:px-6 sm:py-5 ${MANAGEMENT_PAGE_CANVAS_WIDTH_CLASS}`}>
        {view === 'cron' ? <CronConfig /> : <AgentsPage />}
      </div>
    </div>;
    default: return <div className={`mx-auto flex h-full min-h-0 w-full flex-col px-4 py-4 sm:px-6 sm:py-5 ${MANAGEMENT_PAGE_CANVAS_WIDTH_CLASS}`}><MarketplacePage forcedType="skills" /></div>;
  }
}

export function ChatPageLayout({ view, confirmDialog }: ChatPageLayoutProps) {
  const { isMobile } = useViewportLayout();
  return <div className="h-full flex">
    {!isMobile ? <ChatSidebar /> : null}
    {view === 'chat' ? (isMobile ? <ChatMobileShell /> : <ChatConversationPanel />) : (
      <section data-theme-surface="workspace" className={`${resolveManagementWorkspaceClass(view)} flex flex-col`}>
        <div className="min-h-0 flex-1 overflow-hidden"><ManagementPageContent view={view} /></div>
      </section>
    )}
    {confirmDialog}
  </div>;
}
