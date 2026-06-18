import { useRef, type ReactNode } from "react";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import type { NcpMessage } from "@nextclaw/ncp";
import { ChatMessageListContainer } from "@/features/chat/features/message/components/chat-message-list.container";

type ChatConversationContentProps = {
  isAwaitingAssistantOutput: boolean;
  isHistoryLoading: boolean;
  isSending: boolean;
  messages: readonly NcpMessage[];
  sessionKey: string | null;
  showWelcome: boolean;
  welcomeSlot?: ReactNode;
};

export function ChatConversationContent({
  isAwaitingAssistantOutput,
  isHistoryLoading,
  isSending,
  messages,
  sessionKey,
  showWelcome,
  welcomeSlot,
}: ChatConversationContentProps) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const hideEmptyHint =
    isHistoryLoading &&
    messages.length === 0 &&
    !isSending &&
    !isAwaitingAssistantOutput;
  const { onScroll } = useStickyBottomScroll({
    scrollRef: threadRef,
    resetKey: sessionKey,
    isLoading: isHistoryLoading,
    hasContent: messages.length > 0,
    contentVersion: messages[messages.length - 1] ?? null,
  });
  const hasMessages = messages.length > 0;

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
            messages={messages}
            isSending={hasMessages && isSending && isAwaitingAssistantOutput}
          />
        </div>
      )}
    </div>
  );
}
