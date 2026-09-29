import { sanitizeAssistantReplyTags, type NcpMessage, type NcpMessagePart } from "@nextclaw/ncp";

export function isTextLikePart(part: NcpMessagePart): part is Extract<NcpMessagePart, { type: "text" | "rich-text" }> {
  return part.type === "text" || part.type === "rich-text";
}

export function extractTextFromNcpMessage(message: NcpMessage | undefined): string {
  if (!message) return "";
  const normalizedMessage = message.role === "assistant" ? sanitizeAssistantReplyTags(message) : message;
  return normalizedMessage.parts.filter(isTextLikePart).map((part) => part.text).join("");
}
