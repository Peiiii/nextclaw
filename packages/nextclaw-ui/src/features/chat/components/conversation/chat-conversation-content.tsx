import {
  useCallback,
  useRef,
  type ReactNode,
  type UIEvent,
} from "react";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import type { NcpMessage } from "@nextclaw/ncp";
import { ArrowDown } from "lucide-react";
import {
  ChatContextCompactionDivider,
  ChatMessageListContainer,
} from "@/features/chat/features/message/components/chat-message-list.container";
import { ChatConversationTrack } from "@/features/chat/components/conversation/chat-conversation-track";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { SCROLL_BOTTOM_EDGE_FADE_CLASS } from "@/shared/components/ui/scroll-area";
import { t } from "@/shared/lib/i18n";
import type { SessionMessageToolPayloadState } from "@/features/chat/features/ncp/hooks/use-ncp-session-message-history";

type ChatConversationContentProps = {
  bottomSlot?: ReactNode;
  canContinue?: boolean;
  isHistoryLoading: boolean;
  hasPreviousMessages: boolean;
  historyError: Error | null;
  isLoadingPreviousMessages: boolean;
  isContextCompacting?: boolean;
  isSending: boolean;
  messageActionsDisabled?: boolean;
  messages: readonly NcpMessage[];
  messageDetailStates?: Readonly<Record<string, SessionMessageToolPayloadState>>;
  sessionKey: string | null;
  showWelcome: boolean;
  onLoadPreviousMessages: () => Promise<void>;
  onLoadMessageDetails?: (messageId: string) => Promise<void>;
  onContinueRun?: () => Promise<void> | void;
  onEditMessage?: (payload: {
    readonly message: NcpMessage;
    readonly messageId: string;
  }) => Promise<void> | void;
  welcomeSlot?: ReactNode;
};

export function ChatConversationContent({
  bottomSlot,
  canContinue = false,
  isHistoryLoading,
  hasPreviousMessages,
  historyError,
  isLoadingPreviousMessages,
  isContextCompacting = false,
  isSending,
  messageActionsDisabled = false,
  messages,
  messageDetailStates,
  sessionKey,
  showWelcome,
  onLoadPreviousMessages,
  onLoadMessageDetails,
  onContinueRun,
  onEditMessage,
  welcomeSlot,
}: ChatConversationContentProps) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const hasConversationContent = messages.length > 0 || isSending;
  const { isAtBottom, onScroll, scrollToBottom } = useStickyBottomScroll({
    contentRef,
    scrollRef: threadRef,
    resetKey: sessionKey,
    isLoading: isHistoryLoading,
    hasContent: hasConversationContent,
    contentVersion: messages[messages.length - 1] ?? isSending,
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
        className={showWelcome ? "h-full overflow-y-auto custom-scrollbar" : `h-full overflow-y-auto custom-scrollbar ${SCROLL_BOTTOM_EDGE_FADE_CLASS}`}
        style={{ overflowAnchor: "none" }}
      >
        {showWelcome ? (
          (welcomeSlot ?? null)
        ) : (
          <div ref={contentRef} className="pb-7">
            {hasConversationContent ? (
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
                  canContinue={canContinue}
                  messages={messages}
                  messageDetailStates={messageDetailStates}
                  isSending={isSending}
                  messageActionsDisabled={messageActionsDisabled}
                  onContinueRun={onContinueRun}
                  onEditMessage={onEditMessage}
                  onLoadMessageDetails={onLoadMessageDetails}
                  scrollRef={threadRef}
                  sessionKey={sessionKey}
                />
                {isContextCompacting ? <ChatContextCompactionDivider /> : null}
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
          className="absolute bottom-4 left-1/2 z-10 h-9 w-9 -translate-x-1/2 rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur hover:bg-[var(--interaction-hover)] hover:text-accent-foreground"
        />
      ) : null}
    </div>
  );
}
