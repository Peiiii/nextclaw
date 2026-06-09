import { useRef } from "react";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import { ChatMessageListContainer } from "@/features/chat/features/message/components/chat-message-list.container";
import { ChatWelcome } from "@/features/chat/components/chat-welcome";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { resolveAgentRuntimeSessionType } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { useChatInputStore } from "@/features/chat/stores/chat-input.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { useAgents } from "@/shared/hooks/use-agents";

export function ChatConversationContent() {
  const presenter = usePresenter();
  const defaultSessionType = useChatInputStore(
    (state) => state.snapshot.defaultSessionType,
  );
  const selectedAgentId = useChatSessionListStore(
    (state) => state.snapshot.selectedAgentId,
  );
  const snapshot = useChatThreadStore((state) => state.snapshot);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const agentsQuery = useAgents();
  const draftAgentId = snapshot.agentId ?? selectedAgentId;
  const availableAgents =
    (agentsQuery.data?.agents?.length ?? 0) > 0
      ? (agentsQuery.data?.agents ?? [])
      : [{ id: draftAgentId }];
  const showWelcome =
    !snapshot.canDeleteSession &&
    !snapshot.hasSubmittedDraftMessage &&
    snapshot.messages.length === 0 &&
    !snapshot.isSending;
  const hideEmptyHint =
    snapshot.isHistoryLoading &&
    snapshot.messages.length === 0 &&
    !snapshot.isSending &&
    !snapshot.isAwaitingAssistantOutput;
  const resolveDraftAgent = (agentId: string) =>
    availableAgents.find((agent) => agent.id === agentId) ?? null;
  const createDraftSessionForAgent = () => {
    const sessionType = resolveAgentRuntimeSessionType(
      resolveDraftAgent(draftAgentId),
      defaultSessionType,
    );
    presenter.chatSessionListManager.createSession(sessionType);
  };
  const selectDraftAgent = (agentId: string) => {
    presenter.chatSessionListManager.setSelectedAgentId(agentId);
    presenter.chatInputManager.setPendingSessionType(
      resolveAgentRuntimeSessionType(
        resolveDraftAgent(agentId),
        defaultSessionType,
      ),
    );
  };
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
        <ChatWelcome
          onCreateSession={createDraftSessionForAgent}
          agents={availableAgents}
          selectedAgentId={draftAgentId}
          onSelectAgent={selectDraftAgent}
        />
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
