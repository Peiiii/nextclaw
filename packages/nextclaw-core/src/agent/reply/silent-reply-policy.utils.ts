import { isSilentReplyText, SILENT_REPLY_TOKEN } from "./tokens.js";

export type SilentReplyDropReason = "empty" | "silent";

export type SilentReplyDecision = {
  content: string;
  shouldDrop: boolean;
  reason?: SilentReplyDropReason;
};

export function evaluateSilentReply(params: {
  content: string | null | undefined;
  media?: string[];
}): SilentReplyDecision {
  const rawContent = params.content ?? "";
  const media = params.media ?? [];
  const hasMedia = media.length > 0;
  const trimmed = rawContent.trim();

  if (!trimmed && !hasMedia) {
    return {
      content: rawContent,
      shouldDrop: true,
      reason: "empty"
    };
  }

  if (isSilentReplyText(rawContent, SILENT_REPLY_TOKEN)) {
    return {
      content: hasMedia ? "" : rawContent,
      shouldDrop: !hasMedia,
      reason: "silent"
    };
  }

  return {
    content: rawContent,
    shouldDrop: false
  };
}

