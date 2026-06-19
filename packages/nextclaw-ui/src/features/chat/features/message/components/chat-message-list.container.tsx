import { useMemo } from "react";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  type ChatMessageViewModel,
  ChatMessageList,
} from "@nextclaw/agent-chat-ui";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import {
  adaptChatMessage,
  type ChatMessageAdapterTexts,
  type ChatMessageSource,
} from "@/features/chat/features/message/utils/chat-message.utils";
import { readInlineTokensFromMetadata } from "@/features/chat/features/input/utils/chat-inline-token.utils";
import { adaptNcpMessageToUiMessage } from "@/features/chat/features/session/utils/ncp-session-adapter.utils";
import {
  readContextCompactionTimeline,
  type ContextCompactionTimelineView,
} from "@/features/chat/features/session/utils/ncp-session-context-metadata.utils";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { ChatInlinePanelAppCard } from "@/features/chat/features/message/components/chat-inline-panel-app-card";
import { useI18n } from "@/app/components/i18n-provider";
import { formatDateTime, t } from "@/shared/lib/i18n";

type ChatMessageListContainerProps = {
  messages: readonly NcpMessage[];
  isSending: boolean;
  className?: string;
};

const INHERITED_FROM_SESSION_METADATA_KEY = "inherited_from_session_id";

const messageViewModelCache = new WeakMap<
  NcpMessage,
  { language: string; viewModel: ChatMessageViewModel }
>();

type ContextInheritanceTimelineView = {
  sourceSessionId: string;
  inheritedMessageCount: number;
};

type ContextInheritanceTimelineBoundary = ContextInheritanceTimelineView & {
  boundaryIndex: number;
};

type ChatTimelineItem =
  | {
      kind: "messages";
      key: string;
      messages: ChatMessageViewModel[];
    }
  | {
      kind: "compaction";
      key: string;
      checkpoint: ContextCompactionTimelineView;
    }
  | {
      kind: "context-inheritance";
      key: string;
      inheritance: ContextInheritanceTimelineView;
    };

function buildChatMessageAdapterTexts(
  language: string,
): ChatMessageAdapterTexts {
  void language;
  return {
    roleLabels: {
      user: t("chatRoleUser"),
      assistant: t("chatRoleAssistant"),
      tool: t("chatRoleTool"),
      system: t("chatRoleSystem"),
      fallback: t("chatRoleMessage"),
    },
    reasoningLabel: t("chatReasoning"),
    toolCallLabel: t("chatToolCall"),
    toolResultLabel: t("chatToolResult"),
    toolInputLabel: t("chatToolInput"),
    toolNoOutputLabel: t("chatToolNoOutput"),
    toolOutputLabel: t("chatToolOutput"),
    toolStatusPreparingLabel: t("chatToolStatusPreparing"),
    toolStatusRunningLabel: t("chatToolStatusRunning"),
    toolStatusCompletedLabel: t("chatToolStatusCompleted"),
    toolStatusFailedLabel: t("chatToolStatusFailed"),
    toolStatusCancelledLabel: t("chatToolStatusCancelled"),
    showContentActionLabel: t("chatShowContentAction"),
    imageAttachmentLabel: t("chatImageAttachment"),
    fileAttachmentLabel: t("chatFileAttachment"),
    unknownPartLabel: t("chatUnknownPart"),
  };
}

function buildChatMessageTexts(language: string) {
  void language;
  return {
    copyCodeLabel: t("chatCodeCopy"),
    copiedCodeLabel: t("chatCodeCopied"),
    copyMessageLabel: t("chatMessageCopy"),
    copiedMessageLabel: t("chatMessageCopied"),
    typingLabel: t("chatTyping"),
    attachmentOpenLabel: t("chatAttachmentOpen"),
    attachmentAttachedLabel: t("chatAttachmentAttached"),
    attachmentCategoryLabels: {
      archive: t("chatAttachmentCategoryArchive"),
      audio: t("chatAttachmentCategoryAudio"),
      code: t("chatAttachmentCategoryCode"),
      data: t("chatAttachmentCategoryData"),
      document: t("chatAttachmentCategoryDocument"),
      generic: t("chatAttachmentCategoryGeneric"),
      image: t("chatAttachmentCategoryImage"),
      pdf: t("chatAttachmentCategoryPdf"),
      sheet: t("chatAttachmentCategorySheet"),
      video: t("chatAttachmentCategoryVideo"),
    },
  };
}

function ChatContextCompactionDivider({
  checkpoint,
}: {
  checkpoint: ContextCompactionTimelineView;
}) {
  const title = [
    `${t("chatContextCompactionCoveredMessages")}: ${checkpoint.coveredSessionMessageCount}`,
    `${t("chatContextCompactionOriginalTokens")}: ${checkpoint.originalEstimatedTokens}`,
    `${t("chatContextCompactionProjectedTokens")}: ${checkpoint.projectedEstimatedTokens}`,
  ].join("\n");
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] text-gray-500" title={title}>
      <div className="h-px flex-1 bg-gray-200" />
      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
        {checkpoint.status === "compressing" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        )}
        <span>
          {checkpoint.status === "compressing"
            ? t("chatContextCompactionCompressing")
            : t("chatContextCompactionCompressed")}
        </span>
      </div>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

function ChatContextInheritanceDivider({
  inheritance,
}: {
  inheritance: ContextInheritanceTimelineView;
}) {
  const title = [
    `${t("chatContextInheritanceSourceSession")}: ${inheritance.sourceSessionId}`,
    `${t("chatContextInheritanceMessages")}: ${inheritance.inheritedMessageCount}`,
  ].join("\n");
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] text-emerald-700" title={title}>
      <div className="h-px flex-1 bg-emerald-100" />
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>{t("chatContextInheritanceInherited")}</span>
      </div>
      <div className="h-px flex-1 bg-emerald-100" />
    </div>
  );
}

function resolveCompactionBoundaryIndex(params: {
  rawMessages: readonly NcpMessage[];
  visibleRawMessages: readonly NcpMessage[];
  rawMessageId: string;
}): number {
  const {
    rawMessageId,
    rawMessages,
    visibleRawMessages,
  } = params;
  const physicalIndex = rawMessages.findIndex(
    (message) => message.id === rawMessageId,
  );
  if (physicalIndex < 0) {
    return visibleRawMessages.length - 1;
  }
  const previousVisibleCount = rawMessages
    .slice(0, physicalIndex)
    .filter(isVisibleChatMessage).length;
  return previousVisibleCount - 1;
}

function readInheritedSourceSessionId(message: NcpMessage): string | null {
  const value = message.metadata?.[INHERITED_FROM_SESSION_METADATA_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isVisibleChatMessage(message: NcpMessage): boolean {
  return !readContextCompactionTimeline(message) && !readInheritedSourceSessionId(message);
}

function resolveContextInheritanceBoundary(
  messages: readonly NcpMessage[],
): ContextInheritanceTimelineBoundary | null {
  const boundaryIndex = messages.findIndex((message) => readInheritedSourceSessionId(message));
  if (boundaryIndex < 0) {
    return null;
  }
  const sourceSessionId = readInheritedSourceSessionId(messages[boundaryIndex]);
  if (!sourceSessionId) {
    return null;
  }
  return {
    boundaryIndex: messages.slice(0, boundaryIndex).filter(isVisibleChatMessage).length,
    sourceSessionId,
    inheritedMessageCount: messages.filter((message) => readInheritedSourceSessionId(message) === sourceSessionId).length,
  };
}

function buildTimelineItems(params: {
  rawMessages: readonly NcpMessage[];
  messages: ChatMessageViewModel[];
}): ChatTimelineItem[] {
  const visibleRawMessages = params.rawMessages.filter(isVisibleChatMessage);
  const checkpoints = params.rawMessages
    .map((message) => ({
      rawMessageId: message.id,
      checkpoint: readContextCompactionTimeline(message),
    }))
    .filter(
      (entry): entry is { rawMessageId: string; checkpoint: ContextCompactionTimelineView } =>
        Boolean(entry.checkpoint),
    )
    .map((entry) => ({
      key: entry.rawMessageId,
      checkpoint: entry.checkpoint,
      boundaryIndex: resolveCompactionBoundaryIndex({
        rawMessages: params.rawMessages,
        visibleRawMessages,
        rawMessageId: entry.rawMessageId,
      }),
    }))
    .sort((left, right) => left.boundaryIndex - right.boundaryIndex);
  const contextInheritance = resolveContextInheritanceBoundary(params.rawMessages);

  const items: ChatTimelineItem[] = [];
  let pendingMessages: ChatMessageViewModel[] = [];
  let checkpointCursor = 0;
  const flushPendingMessages = (key: string) => {
    if (pendingMessages.length === 0) {
      return;
    }
    items.push({
      kind: "messages",
      key,
      messages: pendingMessages,
    });
    pendingMessages = [];
  };

  visibleRawMessages.forEach((rawMessage, index) => {
    if (contextInheritance?.boundaryIndex === index) {
      flushPendingMessages("messages-before-context-inheritance");
      items.push({
        kind: "context-inheritance",
        key: "context-inheritance",
        inheritance: contextInheritance,
      });
    }
    const message = params.messages[index];
    if (message) {
      pendingMessages.push(message);
    }
    while (checkpointCursor < checkpoints.length && checkpoints[checkpointCursor]?.boundaryIndex <= index) {
      const currentCheckpoint = checkpoints[checkpointCursor];
      flushPendingMessages(`messages-before-${currentCheckpoint.key}`);
      items.push({
        kind: "compaction",
        key: currentCheckpoint.key,
        checkpoint: currentCheckpoint.checkpoint,
      });
      checkpointCursor += 1;
    }
  });
  if (contextInheritance?.boundaryIndex === visibleRawMessages.length) {
    flushPendingMessages("messages-before-context-inheritance");
    items.push({
      kind: "context-inheritance",
      key: "context-inheritance",
      inheritance: contextInheritance,
    });
  }
  while (checkpointCursor < checkpoints.length) {
    const currentCheckpoint = checkpoints[checkpointCursor];
    flushPendingMessages(`messages-before-${currentCheckpoint.key}`);
    items.push({
      kind: "compaction",
      key: currentCheckpoint.key,
      checkpoint: currentCheckpoint.checkpoint,
    });
    checkpointCursor += 1;
  }
  flushPendingMessages("messages-final");
  if (items.length === 0) {
    items.push({
      kind: "messages",
      key: "messages-empty",
      messages: [],
    });
  }
  return items;
}

export function ChatMessageListContainer({
  messages: rawMessages,
  isSending,
  className,
}: ChatMessageListContainerProps) {
  const presenter = usePresenter();
  const { language } = useI18n();
  const texts = useMemo<ChatMessageAdapterTexts>(
    () => buildChatMessageAdapterTexts(language),
    [language],
  );

  const messages = useMemo(() => {
    return rawMessages.flatMap((message) => {
      if (!isVisibleChatMessage(message)) {
        return [];
      }
      const cached = messageViewModelCache.get(message);
      if (cached && cached.language === language) {
        return [cached.viewModel];
      }

      const uiMessage = adaptNcpMessageToUiMessage(message);
      const sourceMessage: ChatMessageSource = {
        id: uiMessage.id,
        role: uiMessage.role,
        meta: {
          timestamp: uiMessage.meta?.timestamp,
          status: uiMessage.meta?.status,
          inlineTokens: readInlineTokensFromMetadata(message.metadata),
        },
        parts: uiMessage.parts as unknown as ChatMessageSource["parts"],
      };
      const viewModel = adaptChatMessage(sourceMessage, {
        formatTimestamp: (value) => formatDateTime(value, language),
        texts,
      });

      messageViewModelCache.set(message, { language, viewModel });
      return [viewModel];
    });
  }, [language, rawMessages, texts]);

  const hasAssistantDraft = useMemo(
    () =>
      messages.some(
        (message) =>
          message.role === "assistant" &&
          (message.status === "streaming" || message.status === "pending"),
      ),
    [messages],
  );
  const messageTexts = useMemo(
    () => buildChatMessageTexts(language),
    [language],
  );
  const timelineItems = useMemo(
    () => buildTimelineItems({ rawMessages, messages }),
    [messages, rawMessages],
  );
  return (
    <div className={className}>
      {timelineItems.map((item, index) =>
        item.kind === "compaction" ? (
          <ChatContextCompactionDivider key={item.key} checkpoint={item.checkpoint} />
        ) : item.kind === "context-inheritance" ? (
          <ChatContextInheritanceDivider key={item.key} inheritance={item.inheritance} />
        ) : (
          <ChatMessageList
            key={item.key}
            messages={item.messages}
            isSending={index === timelineItems.length - 1 ? isSending : false}
            hasAssistantDraft={hasAssistantDraft}
            texts={messageTexts}
            onToolAction={presenter.chatThreadManager.handleToolAction}
            onFileOpen={presenter.chatThreadManager.openFilePreview}
            renderToolAgent={(agentId) => (
              <AgentIdentityAvatar
                agentId={agentId}
                className="h-4 w-4 shrink-0"
              />
            )}
            renderPanelAppCard={(panelApp) => (
              <ChatInlinePanelAppCard panelApp={panelApp} />
            )}
          />
        ),
      )}
    </div>
  );
}
