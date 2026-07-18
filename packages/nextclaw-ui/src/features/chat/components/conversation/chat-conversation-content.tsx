import { useRef, type ReactNode } from "react";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import type { NcpMessage } from "@nextclaw/ncp";
import { ArrowDown } from "lucide-react";
import { ChatMessageListContainer } from "@/features/chat/features/message/components/chat-message-list.container";
import { ChatConversationTrack } from "@/features/chat/components/conversation/chat-conversation-track";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { t } from "@/shared/lib/i18n";

type ChatConversationContentProps = {
  bottomSlot?: ReactNode;
  isAwaitingAssistantOutput: boolean;
  isHistoryLoading: boolean;
  isSending: boolean;
  messages: readonly NcpMessage[];
  sessionKey: string | null;
  showWelcome: boolean;
  welcomeSlot?: ReactNode;
};

export function ChatConversationContent({
  bottomSlot,
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
  const {
    isAtBottom,
    onScroll,
    scrollToBottom,
  } = useStickyBottomScroll({
    scrollRef: threadRef,
    resetKey: sessionKey,
    isLoading: isHistoryLoading,
    hasContent: messages.length > 0,
    contentVersion: messages[messages.length - 1] ?? null,
  });
  const hasMessages = messages.length > 0;
  const showScrollToBottom = hasMessages && !showWelcome && !isAtBottom;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={threadRef}
        onScroll={onScroll}
        data-chat-scroll-container="true"
        className="h-full overflow-y-auto custom-scrollbar"
      >
        {showWelcome ? (
          welcomeSlot ?? null
        ) : (
          <>
            {hideEmptyHint || !hasMessages ? null : (
              <ChatConversationTrack className="py-4 sm:py-5">
                <ChatMessageListContainer
                  messages={messages}
                  isSending={hasMessages && isSending && isAwaitingAssistantOutput}
                  sessionKey={sessionKey}
                />
              </ChatConversationTrack>
            )}
            {bottomSlot ? (
              <ChatConversationTrack className="pb-4 sm:pb-5">
                {bottomSlot}
              </ChatConversationTrack>
            ) : null}
          </>
        )}
      </div>
      {showScrollToBottom ? (
        <IconActionButton
          icon={<ArrowDown className="h-4 w-4" />}
          label={t("chatScrollToBottom")}
          onClick={scrollToBottom}
          tooltipSide="top"
          className="absolute bottom-4 left-1/2 z-10 h-9 w-9 -translate-x-1/2 rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur hover:bg-accent hover:text-accent-foreground"
        />
      ) : null}
    </div>
  );
}
