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

function formatLifecycleDuration(message: NcpMessage): string | null {
  const startedAt = message.lifecycle?.startedAt;
  const endedAt = message.lifecycle?.endedAt;
  if (!startedAt || !endedAt) {
    return null;
  }
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return null;
  }
  const totalSeconds = Math.round((ended - started) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Outer process collapse only.
 * Tool activity grouping is a separate layer over consecutive tool-cards
 * and must not be mixed into this summary.
 */
export function buildChatMessageProcessSummary({
  message,
  processedLabel,
}: BuildChatMessageProcessSummaryParams): ChatMessageProcessSummarySource | undefined {
  if (!hasCollapsibleAssistantProcess(message)) {
    return undefined;
  }
  const duration = formatLifecycleDuration(message);
  return { label: duration ? `${processedLabel} ${duration}` : processedLabel };
}
