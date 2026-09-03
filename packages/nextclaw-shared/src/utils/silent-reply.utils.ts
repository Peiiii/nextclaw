import type { NcpMessage } from "@nextclaw/ncp";

export const SILENT_REPLY_TOKEN = "<noreply/>";

const SILENT_REPLY_MARKER_PATTERN = /^(?:\s|\\[nrt])*<\s*noreply\s*\/\s*>(?:\s|\\[nrt])*$/i;

export function containsSilentReplyMarker(text: string | null | undefined): boolean {
  return Boolean(text && SILENT_REPLY_MARKER_PATTERN.test(text));
}

export function isSilentReplyNcpMessage(message: NcpMessage): boolean {
  if (message.role !== "assistant") return false;
  const visibleText = message.parts
    .filter((part) => part.type === "text" || part.type === "rich-text")
    .map((part) => part.text)
    .join("");
  return containsSilentReplyMarker(visibleText);
}
