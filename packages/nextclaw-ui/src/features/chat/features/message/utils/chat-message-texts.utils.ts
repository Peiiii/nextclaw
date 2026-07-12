import type { ChatMessageTexts } from "@nextclaw/agent-chat-ui";
import type { ChatMessageAdapterTexts } from "@/features/chat/features/message/utils/chat-message.utils";
import { t } from "@/shared/lib/i18n";

export function buildChatMessageAdapterTexts(
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

export function buildChatMessageTexts(
  language: string,
): ChatMessageTexts {
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
    toolActivitySegmentTemplates: {
      read: {
        one: t("chatToolActivityReadOne"),
        other: t("chatToolActivityReadOther"),
      },
      edit: {
        one: t("chatToolActivityEditOne"),
        other: t("chatToolActivityEditOther"),
      },
      search: {
        one: t("chatToolActivitySearchOne"),
        other: t("chatToolActivitySearchOther"),
      },
      bash: {
        one: t("chatToolActivityBashOne"),
        other: t("chatToolActivityBashOther"),
      },
      web: {
        one: t("chatToolActivityWebOne"),
        other: t("chatToolActivityWebOther"),
      },
      agent: {
        one: t("chatToolActivityAgentOne"),
        other: t("chatToolActivityAgentOther"),
      },
      panel: {
        one: t("chatToolActivityPanelOne"),
        other: t("chatToolActivityPanelOther"),
      },
      other: {
        one: t("chatToolActivityOtherOne"),
        other: t("chatToolActivityOtherOther"),
      },
    },
    toolActivityFailedLabel: t("chatProcessSummaryFailed"),
    toolActivityCancelledLabel: t("chatProcessSummaryCancelled"),
  };
}
