import { useMemo } from "react";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  type ChatFileOpenActionViewModel,
  type ChatToolActionViewModel,
  type ChatMessageViewModel,
  ChatMessageList,
} from "@nextclaw/agent-chat-ui";
import {
  adaptChatMessage,
  type ChatMessageAdapterTexts,
  type ChatMessageSource,
} from "@/features/chat/utils/chat-message.utils";
import { readInlineTokensFromMetadata } from "@/features/chat/utils/chat-inline-token.utils";
import { adaptNcpMessageToUiMessage } from "@/features/chat/utils/ncp-session-adapter.utils";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { useI18n } from "@/app/components/i18n-provider";
import { formatDateTime, t } from "@/shared/lib/i18n";

type ChatMessageListContainerProps = {
  messages: readonly NcpMessage[];
  isSending: boolean;
  className?: string;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
};

const messageViewModelCache = new WeakMap<
  NcpMessage,
  { language: string; viewModel: ChatMessageViewModel }
>();

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

export function ChatMessageListContainer({
  messages: rawMessages,
  isSending,
  className,
  onToolAction,
  onFileOpen,
}: ChatMessageListContainerProps) {
  const { language } = useI18n();
  const texts = useMemo<ChatMessageAdapterTexts>(
    () => buildChatMessageAdapterTexts(language),
    [language],
  );

  const messages = useMemo(() => {
    return rawMessages.map((message) => {
      const cached = messageViewModelCache.get(message);
      if (cached && cached.language === language) {
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
        },
        parts: uiMessage.parts as unknown as ChatMessageSource["parts"],
      };
      const viewModel = adaptChatMessage(sourceMessage, {
        formatTimestamp: (value) => formatDateTime(value, language),
        texts,
      });

      messageViewModelCache.set(message, { language, viewModel });
      return viewModel;
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

  return (
    <ChatMessageList
      messages={messages}
      isSending={isSending}
      hasAssistantDraft={hasAssistantDraft}
      className={className}
      texts={messageTexts}
      onToolAction={onToolAction}
      onFileOpen={onFileOpen}
      renderToolAgent={(agentId) => (
        <AgentIdentityAvatar
          agentId={agentId}
          className="h-4 w-4 shrink-0"
        />
      )}
    />
  );
}
