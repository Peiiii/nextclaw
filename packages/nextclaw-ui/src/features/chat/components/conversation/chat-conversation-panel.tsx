import { ChatInputBarContainer } from "@/features/chat/features/input/components/chat-input-bar.container";
import { ChatConversationAlerts } from "@/features/chat/components/conversation/chat-conversation-alerts";
import { ChatConversationContent } from "@/features/chat/components/conversation/chat-conversation-content";
import { ChatConversationHeaderSection } from "@/features/chat/components/conversation/chat-conversation-header-section";
import { ChatConversationParentBanner } from "@/features/chat/components/conversation/chat-conversation-parent-banner";
import { ChatConversationSkeleton } from "@/features/chat/components/conversation/chat-conversation-skeleton";
import { ChatConversationWorkspaceSection } from "@/features/chat/components/conversation/chat-conversation-workspace-section";
import { useChatInputStore } from "@/features/chat/stores/chat-input.store";

type ChatConversationLayoutMode = "desktop" | "mobile";

export function ChatConversationPanel({
  layoutMode = "desktop",
  onBackToList,
}: {
  layoutMode?: ChatConversationLayoutMode;
  onBackToList?: () => void;
}) {
  const isProviderStateResolved = useChatInputStore(
    (state) => state.snapshot.isProviderStateResolved,
  );

  if (!isProviderStateResolved) {
    return <ChatConversationSkeleton />;
  }

  return (
    <section className="flex-1 min-h-0 flex overflow-hidden bg-gradient-to-b from-gray-50/60 to-white">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatConversationParentBanner />
        <ChatConversationHeaderSection
          layoutMode={layoutMode}
          onBackToList={onBackToList}
        />
        <ChatConversationAlerts />
        <ChatConversationContent />
        <ChatInputBarContainer />
      </div>

      <ChatConversationWorkspaceSection layoutMode={layoutMode} />
    </section>
  );
}
