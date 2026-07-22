import {
  useCallback,
  useRef,
  type ReactNode,
  type UIEvent,
} from "react";
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
  hasPreviousMessages: boolean;
  historyError: Error | null;
  isLoadingPreviousMessages: boolean;
  isSending: boolean;
  messages: readonly NcpMessage[];
  sessionKey: string | null;
  showWelcome: boolean;
  onLoadPreviousMessages: () => Promise<void>;
  welcomeSlot?: ReactNode;
};

export function ChatConversationContent({
  bottomSlot,
  isAwaitingAssistantOutput,
  isHistoryLoading,
  hasPreviousMessages,
  historyError,
  isLoadingPreviousMessages,
  isSending,
  messages,
  sessionKey,
  showWelcome,
  onLoadPreviousMessages,
  welcomeSlot,
}: ChatConversationContentProps) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { isAtBottom, onScroll, scrollToBottom } = useStickyBottomScroll({
    contentRef,
    scrollRef: threadRef,
    resetKey: sessionKey,
    isLoading: isHistoryLoading,
    hasContent: messages.length > 0,
    contentVersion: messages[messages.length - 1] ?? null,
  });
  const hasMessages = messages.length > 0;
  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      onScroll();
      if (
        event.currentTarget.scrollTop <= 320 &&
        hasPreviousMessages &&
        !isLoadingPreviousMessages
      ) {
        void onLoadPreviousMessages();
      }
    },
    [
      hasPreviousMessages,
      isLoadingPreviousMessages,
      onLoadPreviousMessages,
      onScroll,
    ],
  );
  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={threadRef}
        onScroll={handleScroll}
        data-chat-scroll-container="true"
        className="h-full overflow-y-auto custom-scrollbar"
        style={{ overflowAnchor: "none" }}
      >
        {showWelcome ? (
          (welcomeSlot ?? null)
        ) : (
          <div ref={contentRef}>
            {hasMessages ? (
              <ChatConversationTrack className="relative py-4 sm:py-5">
                {historyError ? (
                  <div role="alert" className="flex h-8 justify-center">
                    <button
                      type="button"
                      aria-label={t("chatHistoryRetry")}
                      className="rounded px-1.5 text-xs text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => void onLoadPreviousMessages()}
                    >
                      {t("chatHistoryLoadFailed")} · {t("chatHistoryRetry")}
                    </button>
                  </div>
                ) : isLoadingPreviousMessages ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-[13px] block h-1.5 w-1.5 -translate-x-1/2 animate-pulse rounded-full bg-muted-foreground/50 sm:top-[17px]"
                  />
                ) : null}
                <ChatMessageListContainer
                  messages={messages}
                  isSending={
                    hasMessages && isSending && isAwaitingAssistantOutput
                  }
                  scrollRef={threadRef}
                  sessionKey={sessionKey}
                />
              </ChatConversationTrack>
            ) : null}
            {bottomSlot ? (
              <ChatConversationTrack className="pb-4 sm:pb-5">
                {bottomSlot}
              </ChatConversationTrack>
            ) : null}
          </div>
        )}
      </div>
      {hasMessages && !showWelcome && !isAtBottom ? (
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
