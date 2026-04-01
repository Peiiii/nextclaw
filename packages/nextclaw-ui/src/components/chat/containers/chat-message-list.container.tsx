import { useMemo } from "react";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  type ChatMessageViewModel,
  ChatMessageList,
} from "@nextclaw/agent-chat-ui";
import {
  adaptChatMessage,
  type ChatMessageAdapterTexts,
  type ChatMessageSource,
} from "@/components/chat/adapters/chat-message.adapter";
import { readInlineTokensFromMetadata } from "@/components/chat/chat-inline-token.utils";
import { adaptNcpMessageToUiMessage } from "@/components/chat/ncp/ncp-session-adapter";
import { useI18n } from "@/components/providers/I18nProvider";
import { formatDateTime, t } from "@/lib/i18n";

type ChatMessageListContainerProps = {
  messages: readonly NcpMessage[];
  isSending: boolean;
  className?: string;
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
  };
}

export function ChatMessageListContainer({
  messages: rawMessages,
  isSending,
  className,
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
    />
  );
}
