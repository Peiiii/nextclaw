import { useCallback } from "react";
import { ChatConversationHeaderSection } from "@/features/chat/components/conversation/chat-conversation-header-section";
import { ChatConversationParentBanner } from "@/features/chat/components/conversation/chat-conversation-parent-banner";
import { ChatConversationSkeleton } from "@/features/chat/components/conversation/chat-conversation-skeleton";
import { ChatConversationWorkspaceSection } from "@/features/chat/components/conversation/chat-conversation-workspace-section";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { SessionConversationArea } from "@/features/chat/features/conversation/components/session-conversation-area";
import { useNcpChatProviderStateResolved } from "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";

type ChatConversationLayoutMode = "desktop" | "mobile";

export function ChatConversationPanel({
  layoutMode = "desktop",
  onBackToList,
}: {
  layoutMode?: ChatConversationLayoutMode;
  onBackToList?: () => void;
}) {
  const presenter = usePresenter();
  const isProviderStateResolved = useNcpChatProviderStateResolved();
  const sessionKey = useChatSessionListStore(
    (state) => state.snapshot.selectedSessionKey,
  );
  const handleSessionMaterialized = useCallback((materializedSessionKey: string) => {
    if (!presenter.chatUiManager.isAtChatRoot()) {
      return;
    }
    presenter.chatUiManager.goToSession(materializedSessionKey, { replace: true });
  }, [presenter]);

  if (!isProviderStateResolved) {
    return <ChatConversationSkeleton />;
  }

  return (
    <section className="flex-1 min-h-0 flex overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatConversationParentBanner />
        <ChatConversationHeaderSection
          layoutMode={layoutMode}
          onBackToList={onBackToList}
        />
        <SessionConversationArea
          consumeDraftIntent
          sessionKey={sessionKey}
          onSessionMaterialized={handleSessionMaterialized}
        />
      </div>

      <ChatConversationWorkspaceSection layoutMode={layoutMode} sessionKey={sessionKey} />
    </section>
  );
}
