import type { UiMessage } from "@nextclaw/agent-chat";
import {
  adaptChatMessages,
  type ChatMessageSource,
} from "@/features/chat/features/message/utils/chat-message.utils";

export type { ChatMessageSource } from "@/features/chat/features/message/utils/chat-message.utils";

export function toSource(uiMessages: UiMessage[]): ChatMessageSource[] {
  return uiMessages as unknown as ChatMessageSource[];
}

const defaultTexts = {
  roleLabels: {
    user: "You",
    assistant: "Assistant",
    tool: "Tool",
    system: "System",
    fallback: "Message",
  },
  reasoningLabel: "Reasoning",
  toolCallLabel: "Tool Call",
  toolResultLabel: "Tool Result",
  toolInputLabel: "Input",
  toolNoOutputLabel: "No output",
  toolOutputLabel: "Output",
  toolStatusPreparingLabel: "Preparing",
  toolStatusRunningLabel: "Running",
  toolStatusCompletedLabel: "Completed",
  toolStatusFailedLabel: "Failed",
  toolStatusCancelledLabel: "Cancelled",
  imageAttachmentLabel: "Image attachment",
  fileAttachmentLabel: "File attachment",
  unknownPartLabel: "Unknown Part",
};

export function adapt(uiMessages: ChatMessageSource[]) {
  return adaptChatMessages({
    uiMessages,
    formatTimestamp: (value) => `formatted:${value}`,
    texts: defaultTexts,
  });
}
