import { type NcpMessage, sanitizeAssistantReplyTags } from "@nextclaw/ncp";

export function cloneConversationMessage(message: NcpMessage): NcpMessage {
  return {
    ...message,
    parts: [...message.parts],
    lifecycle: message.lifecycle ? { ...message.lifecycle } : undefined,
    metadata: message.metadata ? { ...message.metadata } : undefined,
  };
}

export function normalizeConversationMessage(message: NcpMessage): NcpMessage {
  return cloneConversationMessage(sanitizeAssistantReplyTags(message));
}
