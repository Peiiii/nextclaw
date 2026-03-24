import type { FeishuConvertContext, FeishuConvertedContent, FeishuMessageResource } from "./content-converter-types.js";
import { millisToDatetime, resolveMentions, safeParse } from "./content-converter-utils.js";

function applyStyle(text: string, style: string[]): string {
  let result = text;
  if (style.includes("bold")) {
    result = `**${result}**`;
  }
  if (style.includes("italic")) {
    result = `*${result}*`;
  }
  if (style.includes("lineThrough")) {
    result = `~~${result}~~`;
  }
  if (style.includes("codeInline")) {
    result = `\`${result}\``;
  }
  if (style.includes("underline")) {
    result = `<u>${result}</u>`;
  }
  return result;
}

function renderPostElement(
  element: Record<string, unknown>,
  context: FeishuConvertContext,
  resources: FeishuMessageResource[]
): string {
  const tag = typeof element.tag === "string" ? element.tag : "";
  if (tag === "text") {
    const text = typeof element.text === "string" ? element.text : "";
    const style = Array.isArray(element.style) ? element.style.filter((item): item is string => typeof item === "string") : [];
    return applyStyle(text, style);
  }
  if (tag === "a") {
    const label = typeof element.text === "string" ? element.text : typeof element.href === "string" ? element.href : "";
    return typeof element.href === "string" ? `[${label}](${element.href})` : label;
  }
  if (tag === "at") {
    const openId = typeof element.user_id === "string" ? element.user_id : "";
    const mapped = context.mentionsByOpenId.get(openId);
    return mapped ? mapped.key : `@${typeof element.user_name === "string" ? element.user_name : openId}`;
  }
  if (tag === "img" && typeof element.image_key === "string") {
    resources.push({ type: "image", fileKey: element.image_key });
    return `![image](${element.image_key})`;
  }
  if (tag === "media" && typeof element.file_key === "string") {
    resources.push({ type: "file", fileKey: element.file_key });
    return `<file key="${element.file_key}"/>`;
  }
  if (tag === "code_block") {
    const language = typeof element.language === "string" ? element.language : "";
    const code = typeof element.text === "string" ? element.text : "";
    return `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
  }
  if (tag === "hr") {
    return "\n---\n";
  }
  return typeof element.text === "string" ? element.text : "";
}

export function convertPostContent(raw: string, context: FeishuConvertContext): FeishuConvertedContent {
  const parsed = safeParse(raw);
  if (!parsed) {
    return { content: "[rich text message]", resources: [] };
  }
  const resources: FeishuMessageResource[] = [];
  const lines: string[] = [];
  if (typeof parsed.title === "string" && parsed.title.trim()) {
    lines.push(`**${parsed.title.trim()}**`, "");
  }
  const contentBlocks = Array.isArray(parsed.content) ? parsed.content : [];
  for (const paragraph of contentBlocks) {
    if (!Array.isArray(paragraph)) {
      continue;
    }
    const line = paragraph
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => renderPostElement(entry, context, resources))
      .join("");
    if (line.trim()) {
      lines.push(line);
    }
  }
  return {
    content: resolveMentions(lines.join("\n").trim() || "[rich text message]", context),
    resources
  };
}

function extractTodoSummary(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }
  const lines: string[] = [];
  for (const paragraph of content) {
    if (!Array.isArray(paragraph)) {
      continue;
    }
    const line = paragraph
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }
        const text = (entry as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      })
      .join("");
    if (line.trim()) {
      lines.push(line.trim());
    }
  }
  return lines.join("\n");
}

export function convertTodoContent(raw: string): FeishuConvertedContent {
  const parsed = safeParse(raw);
  const parts: string[] = [];
  const summary = parsed?.summary;
  if (summary && typeof summary === "object") {
    const title = (summary as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) {
      parts.push(title.trim());
    }
    const content = extractTodoSummary((summary as { content?: unknown }).content);
    if (content) {
      parts.push(content);
    }
  }
  const due = millisToDatetime(parsed?.due_time);
  if (due) {
    parts.push(`Due: ${due}`);
  }
  return {
    content: `<todo>\n${parts.join("\n") || "[todo]"}\n</todo>`,
    resources: []
  };
}

function collectInteractiveText(value: unknown, lines: string[]): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      lines.push(trimmed);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectInteractiveText(entry, lines);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  const preferredKeys = ["title", "content", "text", "plain_text", "value", "label", "name"];
  for (const key of preferredKeys) {
    collectInteractiveText(record[key], lines);
  }
  for (const [key, nested] of Object.entries(record)) {
    if (!preferredKeys.includes(key)) {
      collectInteractiveText(nested, lines);
    }
  }
}

export function convertInteractiveContent(raw: string): FeishuConvertedContent {
  const parsed = safeParse(raw);
  if (!parsed) {
    return { content: "<card>\n[interactive card]\n</card>", resources: [] };
  }
  const lines: string[] = [];
  const header = parsed.header;
  if (header && typeof header === "object") {
    collectInteractiveText((header as Record<string, unknown>).title, lines);
    collectInteractiveText((header as Record<string, unknown>).property, lines);
  }
  collectInteractiveText(parsed.elements, lines);
  collectInteractiveText(parsed.card, lines);
  const uniqueLines = [...new Set(lines)];
  return {
    content: `<card>\n${uniqueLines.join("\n") || "[interactive card]"}\n</card>`,
    resources: []
  };
}
