import { readRecord, readString } from "./codex-openai-responses-bridge-shared.utils.js";

export type OpenAiChatContent = string | Array<Record<string, unknown>> | null;

function normalizeTextPart(value: unknown): string {
  const record = readRecord(value);
  if (!record) {
    return "";
  }
  const type = readString(record.type);
  if (type !== "input_text" && type !== "output_text") {
    return "";
  }
  return readString(record.text) ?? "";
}

function normalizeImageUrl(value: unknown): string | null {
  const record = readRecord(value);
  if (!record || readString(record.type) !== "input_image") {
    return null;
  }
  const source = readRecord(record.source);
  if (!source) {
    return null;
  }
  if (readString(source.type) === "url") {
    return readString(source.url) ?? null;
  }
  if (readString(source.type) === "base64") {
    const mediaType = readString(source.media_type) ?? "application/octet-stream";
    const data = readString(source.data);
    if (!data) {
      return null;
    }
    return `data:${mediaType};base64,${data}`;
  }
  return null;
}

export function normalizeToolOutput(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const text = value.map((entry) => normalizeTextPart(entry)).filter(Boolean).join("");
    if (text) {
      return text;
    }
  }
  try {
    return JSON.stringify(value ?? "");
  } catch {
    return String(value ?? "");
  }
}

export function buildChatContent(content: unknown): OpenAiChatContent {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return null;
  }

  const chatContent: Array<Record<string, unknown>> = [];
  for (const entry of content) {
    const text = normalizeTextPart(entry);
    if (text) {
      chatContent.push({
        type: "text",
        text,
      });
      continue;
    }

    const imageUrl = normalizeImageUrl(entry);
    if (imageUrl) {
      chatContent.push({
        type: "image_url",
        image_url: {
          url: imageUrl,
        },
      });
    }
  }

  if (chatContent.length === 0) {
    return null;
  }
  const textOnly = chatContent.every((entry) => entry.type === "text");
  if (textOnly) {
    return chatContent
      .map((entry) => readString(entry.text) ?? "")
      .join("\n");
  }
  return chatContent;
}

export function mergeChatContent(
  left: OpenAiChatContent,
  right: OpenAiChatContent,
): OpenAiChatContent {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  if (typeof left === "string" && typeof right === "string") {
    return [left, right].filter((value) => value.length > 0).join("\n\n");
  }
  const normalizedLeft =
    typeof left === "string"
      ? [
          {
            type: "text",
            text: left,
          },
        ]
      : left;
  const normalizedRight =
    typeof right === "string"
      ? [
          {
            type: "text",
            text: right,
          },
        ]
      : right;
  return [...normalizedLeft, ...normalizedRight];
}

export function readAssistantMessageText(content: OpenAiChatContent): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((entry) => entry.type === "text")
    .map((entry) => readString(entry.text) ?? "")
    .join("\n");
}
