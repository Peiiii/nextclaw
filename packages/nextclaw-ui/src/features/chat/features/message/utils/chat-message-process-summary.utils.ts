import type { NcpMessage } from "@nextclaw/ncp";
import type { ChatMessageProcessSummarySource } from "@/features/chat/types/chat-message.types";

type BuildChatMessageProcessSummaryParams = {
  message: NcpMessage;
  processedLabel: string;
};

function isAssistantProcessPart(part: NcpMessage["parts"][number]): boolean {
  return part.type === "reasoning" || part.type === "tool-invocation";
}

function isAssistantFinalContentPart(
  part: NcpMessage["parts"][number],
): boolean {
  if (part.type === "text" || part.type === "rich-text") {
    return part.text.trim().length > 0;
  }
  return part.type === "file" || part.type === "source" || part.type === "card";
}

function hasCollapsibleAssistantProcess(message: NcpMessage): boolean {
  if (
    message.role !== "assistant" ||
    message.status === "pending" ||
    message.status === "streaming"
  ) {
    return false;
  }
  let lastProcessPartIndex = -1;
  for (let index = message.parts.length - 1; index >= 0; index -= 1) {
    const part = message.parts[index];
    if (part && isAssistantProcessPart(part)) {
      lastProcessPartIndex = index;
      break;
    }
  }
  return (
    lastProcessPartIndex >= 0 &&
    lastProcessPartIndex < message.parts.length - 1 &&
    message.parts
      .slice(lastProcessPartIndex + 1)
      .some(isAssistantFinalContentPart)
  );
}

export function buildChatMessageProcessSummary({
  message,
  processedLabel,
}: BuildChatMessageProcessSummaryParams): ChatMessageProcessSummarySource | undefined {
  if (!hasCollapsibleAssistantProcess(message)) {
    return undefined;
  }
  return { label: processedLabel };
}
