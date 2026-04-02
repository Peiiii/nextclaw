export const HEARTBEAT_TOKEN = "HEARTBEAT_OK";
export const SILENT_REPLY_TOKEN = "<noreply/>";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SILENT_REPLY_MARKER_PATTERN = /<\s*noreply\s*\/\s*>/i;

export function containsSilentReplyMarker(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }
  return SILENT_REPLY_MARKER_PATTERN.test(text);
}

export function isSilentReplyText(text: string | undefined, token: string = SILENT_REPLY_TOKEN): boolean {
  if (!text) {
    return false;
  }
  if (token === SILENT_REPLY_TOKEN) {
    return containsSilentReplyMarker(text);
  }
  const escaped = escapeRegExp(token);
  const pattern = new RegExp(escaped, "i");
  return pattern.test(text);
}
