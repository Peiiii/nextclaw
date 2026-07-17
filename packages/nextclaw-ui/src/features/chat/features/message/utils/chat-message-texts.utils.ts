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

function buildBuiltInToolStatusLabels() {
  return {
    directory: {
      running: t("chatToolDirectoryRunning"),
      success: t("chatToolDirectorySuccess"),
      error: t("chatToolDirectoryError"),
      cancelled: t("chatToolDirectoryCancelled"),
    },
    web: {
      running: t("chatToolWebRunning"),
      success: t("chatToolWebSuccess"),
      error: t("chatToolWebError"),
      cancelled: t("chatToolWebCancelled"),
    },
    message: {
      running: t("chatToolMessageRunning"),
      success: t("chatToolMessageSuccess"),
      error: t("chatToolMessageError"),
      cancelled: t("chatToolMessageCancelled"),
    },
    session: {
      running: t("chatToolSessionRunning"),
      success: t("chatToolSessionSuccess"),
      error: t("chatToolSessionError"),
      cancelled: t("chatToolSessionCancelled"),
    },
    agent: {
      running: t("chatToolAgentRunning"),
      success: t("chatToolAgentSuccess"),
      error: t("chatToolAgentError"),
      cancelled: t("chatToolAgentCancelled"),
    },
    memory: {
      running: t("chatToolMemoryRunning"),
      success: t("chatToolMemorySuccess"),
      error: t("chatToolMemoryError"),
      cancelled: t("chatToolMemoryCancelled"),
    },
    schedule: {
      running: t("chatToolScheduleRunning"),
      success: t("chatToolScheduleSuccess"),
      error: t("chatToolScheduleError"),
      cancelled: t("chatToolScheduleCancelled"),
    },
    system: {
      running: t("chatToolSystemRunning"),
      success: t("chatToolSystemSuccess"),
      error: t("chatToolSystemError"),
      cancelled: t("chatToolSystemCancelled"),
    },
    image: {
      running: t("chatToolImageRunning"),
      success: t("chatToolImageSuccess"),
      error: t("chatToolImageError"),
      cancelled: t("chatToolImageCancelled"),
    },
    display: {
      running: t("chatToolDisplayRunning"),
      success: t("chatToolDisplaySuccess"),
      error: t("chatToolDisplayError"),
      cancelled: t("chatToolDisplayCancelled"),
    },
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
    mermaidDiagramLabel: t("chatMermaidDiagram"),
    mermaidLoadingLabel: t("chatMermaidLoading"),
    mermaidRenderErrorLabel: t("chatMermaidRenderError"),
    typingLabel: t("chatTyping"),
    reasoningCharacterCountTemplates: {
      inProgress: t("chatReasoningInProgressCharacterCount"),
      completed: t("chatReasoningCompletedCharacterCount"),
    },
    toolStatusLabels: {
      terminal: {
        running: t("chatToolTerminalRunning"),
        success: t("chatToolTerminalSuccess"),
        error: t("chatToolTerminalError"),
        cancelled: t("chatToolTerminalCancelled"),
      },
      fileRead: {
        running: t("chatToolFileReadRunning"),
        success: t("chatToolFileReadSuccess"),
        error: t("chatToolFileReadError"),
        cancelled: t("chatToolFileReadCancelled"),
      },
      fileEdit: {
        running: t("chatToolFileEditRunning"),
        success: t("chatToolFileEditSuccess"),
        error: t("chatToolFileEditError"),
        cancelled: t("chatToolFileEditCancelled"),
      },
      search: {
        running: t("chatToolSearchRunning"),
        success: t("chatToolSearchSuccess"),
        error: t("chatToolSearchError"),
        cancelled: t("chatToolSearchCancelled"),
      },
      builtIn: buildBuiltInToolStatusLabels(),
    },
    attachmentOpenLabel: t("chatAttachmentOpen"),
    attachmentAttachedLabel: t("chatAttachmentAttached"),
    attachmentExpandLabel: t("chatAttachmentExpand"),
    attachmentCloseLabel: t("chatAttachmentClosePreview"),
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
      directory: {
        one: t("chatToolActivityDirectoryOne"),
        other: t("chatToolActivityDirectoryOther"),
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
