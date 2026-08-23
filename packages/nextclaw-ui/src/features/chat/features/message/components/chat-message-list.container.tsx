import {
  useCallback,
  useMemo,
  useState,
  type FocusEvent,
  type RefObject,
} from "react";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  ChatTextSelectionAction,
  type ChatInlineDisplayViewModel,
  type ChatMessageViewModel,
  type ChatPanelAppCardViewModel,
  ChatMessageList,
} from "@nextclaw/agent-chat-ui";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import {
  adaptChatMessage,
  type ChatMessageSource,
} from "@/features/chat/features/message/utils/chat-message.utils";
import { buildChatMessageProcessSummary } from "@/features/chat/features/message/utils/chat-message-process-summary.utils";
import { buildChatMessageExecutionPresentation } from "@/features/chat/features/message/utils/chat-message-execution-summary.utils";
import {
  buildChatMessageAdapterTexts,
  buildChatMessageExecutionLabels,
  buildChatMessageTexts,
} from "@/features/chat/features/message/utils/chat-message-texts.utils";
import {
  readInlineTokensFromMetadata,
} from "@/features/chat/features/input/utils/chat-inline-token.utils";
import {
  adaptNcpMessagePartsForChat,
  adaptNcpMessageToUiMessage,
} from "@/features/chat/features/session/utils/ncp-session-adapter.utils";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { ChatInlineFilePreview } from "@/features/chat/features/message/components/chat-inline-file-preview";
import { ChatInlinePanelAppCard } from "@/features/chat/features/message/components/chat-inline-panel-app-card";
import {
  ChatContextCompactionDivider,
  ChatContextInheritanceDivider,
} from "@/features/chat/features/message/components/chat-message-timeline-dividers";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatMessageLayoutStore } from "@/features/chat/stores/chat-message-layout.store";
import { useNcpChatSelectedSession } from "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state";
import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
import {
  buildSessionTypeOptions,
  DEFAULT_SESSION_TYPE,
  normalizeSessionType,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { useI18n } from "@/app/components/i18n-provider";
import { useChatMessageVirtualizer } from "@/features/chat/features/message/hooks/use-chat-message-virtualizer";
import {
  buildChatMessageTimelineItems,
  CONTEXT_COMPACTION_PART_EXTENSION_TYPE,
  projectVisibleChatMessages,
  type ContextCompactionPartData,
  type ChatTimelineItem,
} from "@/features/chat/features/message/utils/chat-message-timeline.utils";
import { useChatMessageActions } from "@/features/chat/features/message/hooks/use-chat-message-actions";
import { useChatInlineTokenActions } from "@/features/chat/features/message/hooks/use-chat-inline-token-actions";
import { buildServerPathContentUrl } from "@/shared/lib/api";
import { formatDateTime, formatNumber, t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import type { SessionMessageToolPayloadState } from "@/features/chat/features/ncp/hooks/use-ncp-session-message-history";
import { ChatMessageObservationEvent } from "@/features/chat/features/message/components/chat-message-observation-event";
import {
  isObservationEventPartExtensionType,
  readObservationEventPartData,
} from "@/features/chat/features/message/utils/chat-message-observation-event.utils";

type ChatMessageListContainerProps = {
  canContinue?: boolean;
  messages: readonly NcpMessage[];
  messageDetailStates?: Readonly<Record<string, SessionMessageToolPayloadState>>;
  isSending: boolean;
  messageActionsDisabled?: boolean;
  onContinueRun?: () => Promise<void> | void;
  onEditMessage?: (payload: {
    readonly message: NcpMessage;
    readonly messageId: string;
  }) => Promise<void> | void;
  onLoadMessageDetails?: (messageId: string) => Promise<void>;
  sessionKey: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  className?: string;
};

class ChatMessageViewModelAdapter {
  private readonly cache = new WeakMap<
    NcpMessage,
    {
      language: Parameters<typeof formatDateTime>[1];
      processSummaryLabel: string | null;
      executionPresentationKey: string | null;
      viewModel: ChatMessageViewModel;
    }
  >();

  adapt = (params: {
    continuationRunning: boolean;
    executionLabels: ReturnType<typeof buildChatMessageExecutionLabels>;
    language: Parameters<typeof formatDateTime>[1];
    processedLabel: string;
    rawMessages: readonly NcpMessage[];
    texts: ReturnType<typeof buildChatMessageAdapterTexts>;
  }): ChatMessageViewModel[] => {
    const {
      continuationRunning, executionLabels, language, processedLabel, rawMessages, texts,
    } = params;
    return projectVisibleChatMessages(rawMessages, { continuationRunning }).map((message) => {
      const processSummary = buildChatMessageProcessSummary({
        message,
        processedLabel,
        formatDeferredToolSummary: (toolCallCount, toolNames) => {
          const countLabel = t("chatProcessSummaryToolCalls", language)
            .replace("{count}", formatNumber(toolCallCount, language));
          if (toolNames.length === 0) return countLabel;
          const separator = language === "zh" ? "、" : ", ";
          return `${countLabel} · ${toolNames.join(separator)}`;
        },
      });
      const processSummaryLabel = processSummary?.label ?? null;
      const executionPresentation = buildChatMessageExecutionPresentation({
        message,
        labels: executionLabels,
      });
      const executionPresentationKey = executionPresentation?.cacheKey ?? null;
      const cached = this.cache.get(message);
      if (
        cached &&
        cached.language === language &&
        cached.processSummaryLabel === processSummaryLabel &&
        cached.executionPresentationKey === executionPresentationKey
      ) {
        return cached.viewModel;
      }

      const uiMessage = adaptNcpMessageToUiMessage(message);
      const sourceMessage: ChatMessageSource = {
        id: uiMessage.id,
        role: uiMessage.role,
        meta: {
          timestamp: uiMessage.meta?.timestamp,
          status: uiMessage.meta?.status,
          inlineTokens: readInlineTokensFromMetadata(message.metadata),
          processSummary,
          executionSummaryLabel: executionPresentation?.summaryLabel,
          moreActions: executionPresentation?.moreActions,
        },
        parts: adaptNcpMessagePartsForChat(message.parts) as ChatMessageSource["parts"],
      };
      const viewModel = adaptChatMessage(sourceMessage, {
        formatTimestamp: (value) => formatDateTime(value, language),
        texts,
      });

      this.cache.set(message, {
        language,
        processSummaryLabel,
        executionPresentationKey,
        viewModel,
      });
      return viewModel;
    });
  };
}

const chatMessageViewModelAdapter = new ChatMessageViewModelAdapter();

function renderChatInlineDisplay(display: ChatInlineDisplayViewModel) {
  if (display.target.type !== "panel_app") {
    return undefined;
  }
  return (
    <ChatInlinePanelAppCard
      panelApp={{
        appId: display.target.payload.appId,
        params: display.target.payload.params,
        path: display.target.payload.path,
        title: display.title,
      }}
    />
  );
}

const renderChatToolAgent = (agentId: string) => (
  <AgentIdentityAvatar agentId={agentId} className="h-4 w-4 shrink-0" />
);
const renderChatPanelAppCard = (panelApp: ChatPanelAppCardViewModel) => (
  <ChatInlinePanelAppCard panelApp={panelApp} />
);

const CONVERSATION_EXCERPT_MAX_CHARACTERS = 8_000;

function findSelectableMessageElement(range: Range): HTMLElement | null {
  const commonAncestor = range.commonAncestorContainer;
  const element = commonAncestor instanceof Element
    ? commonAncestor
    : commonAncestor.parentElement;
  return element?.closest<HTMLElement>('[data-chat-message-selectable="true"]') ?? null;
}

export { ChatContextCompactionDivider } from "@/features/chat/features/message/components/chat-message-timeline-dividers";

function isAwaitingAssistantOutputRow(
  item: ChatTimelineItem,
  activeRowKey: string | null,
): boolean {
  return item.kind === "typing" || item.key === activeRowKey;
}

export function ChatMessageListContainer({
  canContinue = false,
  messages: rawMessages,
  messageDetailStates,
  isSending,
  messageActionsDisabled = false,
  onContinueRun,
  onEditMessage,
  onLoadMessageDetails,
  scrollRef,
  sessionKey,
  className,
}: ChatMessageListContainerProps) {
  const presenter = usePresenter();
  const { language } = useI18n();
  const messageLayout = useChatMessageLayoutStore((state) => state.layout);
  const selectedSession = useNcpChatSelectedSession(sessionKey);
  const selectedAgentId = useChatSessionListStore(
    (state) => state.snapshot.selectedAgentId,
  );
  const sessionTypesData = useChatQueryStore(
    (state) => state.snapshot.sessionTypesQuery?.data ?? null,
  );
  const activeSessionType = normalizeSessionType(
    selectedSession?.sessionType ?? sessionTypesData?.defaultType,
  );
  const showAssistantHeader =
    activeSessionType !== DEFAULT_SESSION_TYPE ||
    (selectedSession?.agentId ?? selectedAgentId).trim().toLowerCase() !== "main";
  const sessionTypeOption = buildSessionTypeOptions(
    sessionTypesData?.options ?? [],
  ).find((option) => option.value === activeSessionType);
  const assistantAvatarIcon = sessionTypeOption?.icon?.src?.trim() ? (
    <SessionContextIconNode
      icon={{
        kind: "runtime-image",
        src: sessionTypeOption.icon.src,
        alt: sessionTypeOption.icon.alt ?? null,
        name: sessionTypeOption.label,
      }}
      className="h-[65%] w-[65%]"
    />
  ) : undefined;
  const localFileBasePath =
    selectedSession?.workingDir ?? selectedSession?.projectRoot ?? null;
  const renderInlineDisplayWithFiles = useCallback(
    (display: ChatInlineDisplayViewModel) => {
      const panelAppDisplay = renderChatInlineDisplay(display);
      if (panelAppDisplay) {
        return panelAppDisplay;
      }
      if (display.target.type === "file") {
        return (
          <ChatInlineFilePreview
            display={display}
            parentSessionKey={sessionKey}
            sessionProjectRoot={selectedSession?.projectRoot ?? null}
            sessionWorkingDir={localFileBasePath}
            onFileOpen={presenter.chatThreadManager.openFilePreview}
          />
        );
      }
      return undefined;
    },
    [
      localFileBasePath,
      presenter.chatThreadManager,
      selectedSession?.projectRoot,
      sessionKey,
    ],
  );
  const resolveFileContentUrl = useCallback(
    (action: { path: string }) =>
      buildServerPathContentUrl(action.path, localFileBasePath),
    [localFileBasePath],
  );
  const texts = useMemo(
    () => buildChatMessageAdapterTexts(language),
    [language],
  );
  const executionLabels = useMemo(
    () => buildChatMessageExecutionLabels(language),
    [language],
  );
  const adaptedMessages = useMemo(
    () =>
      chatMessageViewModelAdapter.adapt({
        continuationRunning: isSending,
        executionLabels,
        language,
        processedLabel: t("chatProcessSummaryProcessed"),
        rawMessages,
        texts,
      }),
    [executionLabels, isSending, language, rawMessages, texts],
  );
  const { handleMessageAction, messages, renderMessageContent } =
    useChatMessageActions({
      adaptedMessages,
      canContinue,
      disabled: messageActionsDisabled,
      onContinueRun,
      onEditMessage,
      rawMessages,
    });

  const activeAssistantMessage = messages.findLast(
    (message) =>
      message.role === "assistant" &&
      (message.status === "streaming" || message.status === "pending"),
  );
  const hasAssistantDraft = Boolean(activeAssistantMessage);
  const messageTexts = useMemo(
    () => buildChatMessageTexts(language),
    [language],
  );
  const isConversationSelectionAllowed = useCallback(
    ({ range }: { range: Range }) => Boolean(findSelectableMessageElement(range)),
    [],
  );
  const handleConversationSelectionAdd = useCallback(
    ({ range, text }: { range: Range; text: string }) => {
      const messageElement = findSelectableMessageElement(range);
      const messageId = messageElement?.dataset.chatMessageId?.trim();
      const role = messageElement?.dataset.chatMessageRole;
      const label = messageElement?.dataset.chatMessageRoleLabel?.trim();
      if (!messageId || !label || (role !== "assistant" && role !== "user")) return;
      presenter.chatComposerIntentManager.requestConversationExcerptReference({
        targetSessionKey: sessionKey,
        messageId,
        role,
        label,
        excerpt: text,
      });
    },
    [presenter.chatComposerIntentManager, sessionKey],
  );
  const timelineItems = useMemo(
    () => buildChatMessageTimelineItems({ rawMessages, messages }),
    [messages, rawMessages],
  );
  const virtualRows = useMemo<ChatTimelineItem[]>(
    () =>
      isSending && !hasAssistantDraft
        ? [...timelineItems, { kind: "typing", key: "typing" }]
        : timelineItems,
    [hasAssistantDraft, isSending, timelineItems],
  );
  const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null);
  const activeRowKey = activeAssistantMessage ? `message:${activeAssistantMessage.id}` : null;
  const { containerRef, virtualizer } = useChatMessageVirtualizer({
    rows: virtualRows,
    scrollRef,
    activeRowKey,
    focusedRowKey,
  });
  const { handleAttachmentOpen, handleInlineTokenClick } =
    useChatInlineTokenActions({ selectedSession, sessionKey });
  const handleRowBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusedRowKey(null);
    }
  }, []);
  const renderCustomPart = useCallback(
    (part: Extract<ChatMessageViewModel["parts"][number], { type: "custom" }>) => {
      if (isObservationEventPartExtensionType(part.customType)) {
        const event = readObservationEventPartData(part.data);
        return event ? <ChatMessageObservationEvent event={event} /> : undefined;
      }
      if (part.customType !== CONTEXT_COMPACTION_PART_EXTENSION_TYPE) {
        return undefined;
      }
      const data = part.data as ContextCompactionPartData;
      return (
        <ChatContextCompactionDivider
          checkpoint={data.checkpoint}
          inline
        />
      );
    },
    [],
  );
  return (
    <ChatTextSelectionAction
      actionLabel={messageTexts.addSelectionToChatLabel ?? t("chatWorkspaceAddToChat")}
      isSelectionAllowed={isConversationSelectionAllowed}
      maxCharacters={CONVERSATION_EXCERPT_MAX_CHARACTERS}
      onAddToChat={handleConversationSelectionAdd}
      selectionTooLongLabel={messageTexts.selectionTooLongLabel ?? t("chatWorkspaceExcerptSelectionTooLong")}
    >
    <div className={cn("relative", className)} ref={containerRef}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = virtualRows[virtualRow.index];
        if (!item) {
          return null;
        }
        return (
          <div
            data-index={virtualRow.index}
            key={item.key}
            ref={virtualizer.measureElement}
            onBlurCapture={handleRowBlur}
            onFocusCapture={() => setFocusedRowKey(item.key)}
            className="absolute left-0 top-0 w-full"
          >
            {item.kind === "compaction" ? (
              <ChatContextCompactionDivider checkpoint={item.checkpoint} />
            ) : item.kind === "context-inheritance" ? (
              <ChatContextInheritanceDivider inheritance={item.inheritance} />
            ) : (
              <div className={item.kind === "message" ? "pb-5" : undefined}>
                <ChatMessageList
                  assistantAvatarIcon={assistantAvatarIcon}
                  showAssistantHeader={showAssistantHeader}
                  layout={messageLayout}
                  messages={item.kind === "message" ? [item.message] : []}
                  isSending={isAwaitingAssistantOutputRow(item, activeRowKey)}
                  hasAssistantDraft={hasAssistantDraft}
                  texts={messageTexts}
                  onToolAction={presenter.chatThreadManager.handleToolAction}
                  onFileOpen={presenter.chatThreadManager.openFilePreview}
                  onAttachmentOpen={handleAttachmentOpen}
                  onInlineTokenClick={handleInlineTokenClick}
                  onMessageAction={handleMessageAction}
                  resolveMessageToolPayloadState={(messageId) => messageDetailStates?.[messageId]}
                  onMessageToolPayloadRequest={onLoadMessageDetails}
                  resolveFileContentUrl={resolveFileContentUrl}
                  renderCustomPart={renderCustomPart}
                  renderInlineDisplay={renderInlineDisplayWithFiles}
                  renderMessageContent={renderMessageContent}
                  renderToolAgent={renderChatToolAgent}
                  renderPanelAppCard={renderChatPanelAppCard}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
    </ChatTextSelectionAction>
  );
}
