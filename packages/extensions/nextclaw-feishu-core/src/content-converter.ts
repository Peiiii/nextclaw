export type {
  FeishuConvertedContent,
  FeishuConvertContext,
  FeishuMentionInfo,
  FeishuMessageResource,
  FeishuMessageResourceType
} from "./content-converter-types.js";

import type { FeishuConvertContext, FeishuConvertedContent } from "./content-converter-types.js";
import { convertInteractiveContent, convertPostContent, convertTodoContent } from "./content-converter-rich-text.js";
import { buildFeishuConvertContext, formatDuration, millisToDatetime, resolveMentions, safeParse } from "./content-converter-utils.js";

function convertText(raw: string, context: FeishuConvertContext): FeishuConvertedContent {
  const parsed = safeParse(raw);
  const text = typeof parsed?.text === "string" ? parsed.text : raw;
  return {
    content: resolveMentions(text, context) || "[text]",
    resources: []
  };
}

function convertImage(raw: string): FeishuConvertedContent {
  const parsed = safeParse(raw);
  const imageKey = typeof parsed?.image_key === "string" ? parsed.image_key : "";
  return imageKey
    ? {
        content: `![image](${imageKey})`,
        resources: [{ type: "image", fileKey: imageKey }]
      }
    : { content: "[image]", resources: [] };
}

function convertFile(raw: string): FeishuConvertedContent {
  const parsed = safeParse(raw);
  const fileKey = typeof parsed?.file_key === "string" ? parsed.file_key : "";
  if (!fileKey) {
    return { content: "[file]", resources: [] };
  }
  const fileName = typeof parsed?.file_name === "string" ? parsed.file_name : undefined;
  return {
    content: fileName ? `<file key="${fileKey}" name="${fileName}"/>` : `<file key="${fileKey}"/>`,
    resources: [{ type: "file", fileKey, fileName }]
  };
}

function convertAudio(raw: string): FeishuConvertedContent {
  const parsed = safeParse(raw);
  const fileKey = typeof parsed?.file_key === "string" ? parsed.file_key : "";
  if (!fileKey) {
    return { content: "[audio]", resources: [] };
  }
  const duration = typeof parsed?.duration === "number" ? parsed.duration : undefined;
  const durationSuffix = duration !== undefined ? ` duration="${formatDuration(duration)}"` : "";
  return {
    content: `<audio key="${fileKey}"${durationSuffix}/>`,
    resources: [{ type: "audio", fileKey, duration }]
  };
}

function convertSticker(raw: string): FeishuConvertedContent {
  const parsed = safeParse(raw);
  const fileKey = typeof parsed?.file_key === "string" ? parsed.file_key : "";
  return fileKey
    ? {
        content: `<sticker key="${fileKey}"/>`,
        resources: [{ type: "sticker", fileKey }]
      }
    : { content: "[sticker]", resources: [] };
}

function formatCalendarContent(parsed?: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof parsed?.summary === "string" && parsed.summary.trim()) {
    parts.push(`📅 ${parsed.summary.trim()}`);
  }
  const start = millisToDatetime(parsed?.start_time);
  const end = millisToDatetime(parsed?.end_time);
  if (start && end) {
    parts.push(`🕙 ${start} ~ ${end}`);
  } else if (start) {
    parts.push(`🕙 ${start}`);
  }
  return parts.join("\n") || "[calendar event]";
}

function convertCalendar(raw: string, wrapper: "calendar" | "calendar_invite" | "calendar_share"): FeishuConvertedContent {
  const parsed = safeParse(raw);
  return {
    content: `<${wrapper}>${formatCalendarContent(parsed)}</${wrapper}>`,
    resources: []
  };
}

export { buildFeishuConvertContext };

export function convertFeishuMessageContent(
  raw: string,
  messageType: string,
  context?: FeishuConvertContext
): FeishuConvertedContent {
  const convertContext =
    context ??
    ({
      mentions: new Map(),
      mentionsByOpenId: new Map(),
      stripBotMentions: false
    } satisfies FeishuConvertContext);
  switch (messageType) {
    case "text":
      return convertText(raw, convertContext);
    case "post":
      return convertPostContent(raw, convertContext);
    case "image":
      return convertImage(raw);
    case "file":
      return convertFile(raw);
    case "audio":
      return convertAudio(raw);
    case "sticker":
      return convertSticker(raw);
    case "interactive":
      return convertInteractiveContent(raw);
    case "share_calendar_event":
      return convertCalendar(raw, "calendar_share");
    case "calendar":
      return convertCalendar(raw, "calendar_invite");
    case "general_calendar":
      return convertCalendar(raw, "calendar");
    case "todo":
      return convertTodoContent(raw);
    default:
      return {
        content: raw || `[${messageType || "message"}]`,
        resources: []
      };
  }
}
