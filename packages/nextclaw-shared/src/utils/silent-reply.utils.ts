import type { NcpMessage } from "@nextclaw/ncp";

export const SILENT_REPLY_TOKEN = "<noreply/>";

const SILENT_REPLY_MARKER_PATTERN = /<\s*noreply\s*\/\s*>/i;

export function containsSilentReplyMarker(text: string | null | undefined): boolean {
  return Boolean(text && SILENT_REPLY_MARKER_PATTERN.test(text));
}

export function isSilentReplyNcpMessage(message: NcpMessage): boolean {
  return message.role === "assistant" && message.parts.some(
    (part) => (part.type === "text" || part.type === "rich-text") && containsSilentReplyMarker(part.text),
  );
}
