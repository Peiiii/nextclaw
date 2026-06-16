import { useRef, type ReactNode } from "react";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import { ChatMessageListContainer } from "@/features/chat/features/message/components/chat-message-list.container";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";

type ChatConversationContentProps = {
  showWelcome: boolean;
  welcomeSlot?: ReactNode;
};

export function ChatConversationContent({
  showWelcome,
  welcomeSlot,
}: ChatConversationContentProps) {
  const snapshot = useChatThreadStore((state) => state.snapshot);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const hideEmptyHint =
    snapshot.isHistoryLoading &&
    snapshot.messages.length === 0 &&
    !snapshot.isSending &&
    !snapshot.isAwaitingAssistantOutput;
  const { onScroll } = useStickyBottomScroll({
    scrollRef: threadRef,
    resetKey: snapshot.sessionKey,
    isLoading: snapshot.isHistoryLoading,
    hasContent: snapshot.messages.length > 0,
    contentVersion: snapshot.messages[snapshot.messages.length - 1] ?? null,
  });
  const hasMessages = snapshot.messages.length > 0;
  const isAwaitingAssistantOutput =
    hasMessages && snapshot.isSending && snapshot.isAwaitingAssistantOutput;

  return (
    <div
      ref={threadRef}
      onScroll={onScroll}
      data-chat-scroll-container="true"
      className="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
    >
      {showWelcome ? (
        welcomeSlot ?? null
      ) : hideEmptyHint || !hasMessages ? null : (
        <div className="mx-auto w-full max-w-[min(1120px,100%)] px-4 py-4 sm:px-6 sm:py-5">
          <ChatMessageListContainer
            messages={snapshot.messages}
            isSending={isAwaitingAssistantOutput}
          />
        </div>
      )}
    </div>
  );
}
