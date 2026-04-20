import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { ChatSidebar } from "@/components/chat/containers/chat-sidebar";
import { ChatConversationPanel } from "@/components/chat/chat-conversation-panel";
import { AgentsPage } from "@/components/agents/agents-page";
import { CronConfig } from "@/components/config/CronConfig";
import { MarketplacePage } from "@/components/marketplace/marketplace-page";
export type MainPanelView = "chat" | "cron" | "skills" | "agents";
export type ChatPageProps = {
  view: MainPanelView;
};
type UseChatSessionSyncParams = {
  view: MainPanelView;
  routeSessionKey: string | null;
  selectedSessionKey: string | null;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  resetStreamState: () => void;
};
export function useChatSessionSync(params: UseChatSessionSyncParams): void {
  const {
    view,
    routeSessionKey,
    selectedSessionKey,
    setSelectedSessionKey,
    selectedSessionKeyRef,
    resetStreamState,
  } = params;

  useEffect(() => {
    if (view !== "chat") {
      return;
    }
    if (routeSessionKey) {
      if (selectedSessionKey !== routeSessionKey) {
        setSelectedSessionKey(routeSessionKey);
      }
      return;
    }
    if (selectedSessionKey !== null) {
      setSelectedSessionKey(null);
      resetStreamState();
    }
  }, [
    resetStreamState,
    routeSessionKey,
    selectedSessionKey,
    setSelectedSessionKey,
    view,
  ]);

  useEffect(() => {
    selectedSessionKeyRef.current = selectedSessionKey;
  }, [selectedSessionKey, selectedSessionKeyRef]);
}
type ChatPageLayoutProps = {
  view: MainPanelView;
  confirmDialog: JSX.Element;
};
export function ChatPageLayout({ view, confirmDialog }: ChatPageLayoutProps) {
  return (
    <div className="h-full flex">
      <ChatSidebar />

      {view === "chat" ? (
        <ChatConversationPanel />
      ) : (
        <section className="flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-gray-50/60 to-white">
          {view === "cron" ? (
            <div className="h-full overflow-auto custom-scrollbar">
              <div className="mx-auto w-full max-w-[min(1120px,100%)] px-6 py-5">
                <CronConfig />
              </div>
            </div>
          ) : view === "agents" ? (
            <div className="h-full overflow-auto custom-scrollbar">
              <div className="mx-auto w-full max-w-[min(1180px,100%)] px-6 py-5">
                <AgentsPage />
              </div>
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[min(1120px,100%)] flex-col px-6 py-5">
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
