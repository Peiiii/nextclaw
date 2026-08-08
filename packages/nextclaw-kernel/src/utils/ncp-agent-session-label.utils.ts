import type { NcpMessage } from "@nextclaw/ncp";

const AUTO_SESSION_LABEL_MAX_LENGTH = 64;

export function resolveNcpAgentSessionLabel(
  messages: readonly NcpMessage[],
): string | null {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    for (const part of message.parts) {
      if (part.type !== "text" && part.type !== "rich-text") {
        continue;
      }
      const text = typeof part.text === "string" ? part.text.trim() : "";
      if (text) {
        return truncateLabel(text);
      }
    }
  }
  return null;
}

function truncateLabel(value: string): string {
  const chars = Array.from(value);
  return chars.length <= AUTO_SESSION_LABEL_MAX_LENGTH
    ? value
    : `${chars.slice(0, AUTO_SESSION_LABEL_MAX_LENGTH).join("")}...`;
}
