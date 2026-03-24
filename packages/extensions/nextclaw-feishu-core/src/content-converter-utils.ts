import type { FeishuConvertContext, FeishuMentionInfo, FeishuMentionLike } from "./content-converter-types.js";

export function safeParse(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatDuration(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  if (seconds < 1) {
    return `${milliseconds}ms`;
  }
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

export function millisToDatetime(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return typeof value === "string" ? value : "";
  }
  const utc8Offset = 8 * 60 * 60 * 1000;
  const date = new Date(numeric + utc8Offset);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function extractMentionOpenId(id: unknown): string {
  if (typeof id === "string") {
    return id;
  }
  if (id && typeof id === "object" && "open_id" in id) {
    const value = (id as { open_id?: unknown }).open_id;
    return typeof value === "string" ? value : "";
  }
  return "";
}

export function resolveMentions(text: string, context: FeishuConvertContext): string {
  if (context.mentions.size === 0) {
    return text;
  }
  let result = text;
  for (const [key, mention] of context.mentions) {
    if (mention.isBot && context.stripBotMentions) {
      result = result.replace(new RegExp(`${escapeRegExp(key)}\\s*`, "g"), "").trim();
      if (mention.name) {
        result = result.replace(new RegExp(`@${escapeRegExp(mention.name)}\\s*`, "g"), "").trim();
      }
      continue;
    }
    result = result.replace(new RegExp(escapeRegExp(key), "g"), `@${mention.name || mention.openId}`);
  }
  return result;
}

export function buildFeishuConvertContext(params?: {
  mentions?: unknown[];
  stripBotMentions?: boolean;
  botOpenId?: string;
  botName?: string;
}): FeishuConvertContext {
  const mentions = new Map<string, FeishuMentionInfo>();
  const mentionsByOpenId = new Map<string, FeishuMentionInfo>();
  const mentionList = Array.isArray(params?.mentions) ? params?.mentions : [];
  for (const entry of mentionList) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const mention = entry as FeishuMentionLike;
    const key = typeof mention.key === "string" ? mention.key : "";
    const openId = extractMentionOpenId(mention.id) || (typeof mention.open_id === "string" ? mention.open_id : "");
    if (!key || !openId) {
      continue;
    }
    const name = typeof mention.name === "string" ? mention.name : openId;
    const isBot =
      mention.is_bot === true ||
      openId === params?.botOpenId ||
      (typeof params?.botName === "string" && params.botName.length > 0 && name === params.botName);
    const info: FeishuMentionInfo = { key, openId, name, isBot };
    mentions.set(key, info);
    mentionsByOpenId.set(openId, info);
  }
  return {
    mentions,
    mentionsByOpenId,
    stripBotMentions: params?.stripBotMentions ?? false
  };
}
