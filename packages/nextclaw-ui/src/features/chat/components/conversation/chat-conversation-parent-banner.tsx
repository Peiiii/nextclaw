import { ChatParentSessionBanner } from "@/features/chat/components/conversation/chat-conversation-header";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";

export function ChatConversationParentBanner() {
  const presenter = usePresenter();
  const snapshot = useChatThreadStore((state) => state.snapshot);
  return (
    <ChatParentSessionBanner
      parentSessionLabel={
        snapshot.parentSessionKey ? (snapshot.parentSessionLabel ?? null) : null
      }
      onGoToParentSession={presenter.chatThreadManager.goToParentSession}
    />
  );
}
