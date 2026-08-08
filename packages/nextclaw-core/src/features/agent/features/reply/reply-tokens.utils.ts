import {
  containsSilentReplyMarker,
  SILENT_REPLY_TOKEN,
} from "@nextclaw/shared";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export { containsSilentReplyMarker, SILENT_REPLY_TOKEN };

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
