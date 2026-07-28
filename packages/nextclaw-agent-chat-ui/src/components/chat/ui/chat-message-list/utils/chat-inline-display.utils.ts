import type {
  ChatContentParamValue,
  ChatContentParams,
  ChatFilePreviewViewer,
  ChatInlineDisplayTarget,
  ChatInlineDisplayViewModel,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

const INLINE_DISPLAY_LANGUAGE = "nextclaw-inline";
const CODE_LANGUAGE_REGEX = /language-([a-z0-9-]+)/i;
const FILE_PREVIEW_VIEWERS = new Set<ChatFilePreviewViewer>([
  "auto",
  "source",
  "rendered",
]);
const CONTENT_PARAMS_MAX_DEPTH = 32;
const CONTENT_PARAMS_MAX_SERIALIZED_BYTES = 64 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0
    ? Number(value)
    : undefined;
}

function readFilePreviewViewer(value: unknown): ChatFilePreviewViewer | undefined {
  const viewer = readString(value);
  return viewer && FILE_PREVIEW_VIEWERS.has(viewer as ChatFilePreviewViewer)
    ? (viewer as ChatFilePreviewViewer)
    : undefined;
}

function readTargetPayload(record: Record<string, unknown>): Record<string, unknown> | null {
  const { payload } = record;
  return isRecord(payload) ? payload : null;
}

function isContentParamValue(
  value: unknown,
  depth: number,
): value is ChatContentParamValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (depth >= CONTENT_PARAMS_MAX_DEPTH || typeof value !== "object") {
    return false;
  }
  const values = Array.isArray(value) ? value : Object.values(value);
  return values.every((item) => isContentParamValue(item, depth + 1));
}

function readContentParams(value: unknown): ChatContentParams | undefined | null {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (!isRecord(value) || !isContentParamValue(value, 0)) {
    return null;
  }
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <=
    CONTENT_PARAMS_MAX_SERIALIZED_BYTES
    ? value
    : null;
}

function readFileTarget(record: Record<string, unknown>): ChatInlineDisplayTarget | null {
  const payload = readTargetPayload(record);
  if (!payload) {
    return null;
  }
  const path = readString(payload.path);
  if (!path) {
    return null;
  }
  const viewer = readFilePreviewViewer(payload.viewer);
  const params = readContentParams(payload.params);
  if (
    params === null ||
    (params && (viewer === "source" || !/\.html?$/i.test(path)))
  ) {
    return null;
  }
  return {
    type: "file",
    payload: {
      path,
      line: readPositiveInteger(payload.line),
      column: readPositiveInteger(payload.column),
      viewer,
      params: params ?? undefined,
    },
  };
}

function readUrlTarget(record: Record<string, unknown>): ChatInlineDisplayTarget | null {
  const payload = readTargetPayload(record);
  if (!payload) {
    return null;
  }
  const url = readString(payload.url);
  if (!url) {
    return null;
  }
  return {
    type: "url",
    payload: { url },
  };
}

function readPanelAppTarget(record: Record<string, unknown>): ChatInlineDisplayTarget | null {
  const payload = readTargetPayload(record);
  if (!payload) {
    return null;
  }
  const appId = readString(payload.appId);
  if (!appId) {
    return null;
  }
  const params = readContentParams(payload.params);
  if (params === null) {
    return null;
  }
  return {
    type: "panel_app",
    payload: {
      appId,
      path: readString(payload.path),
      params: params ?? undefined,
    },
  };
}

function readJsonTarget(record: Record<string, unknown>): ChatInlineDisplayTarget | null {
  const payload = readTargetPayload(record);
  if (!payload || !("value" in payload)) {
    return null;
  }
  return {
    type: "json",
    payload: { value: payload.value },
  };
}

function readInlineDisplayTarget(value: unknown): ChatInlineDisplayTarget | null {
  if (!isRecord(value)) {
    return null;
  }
  const type = readString(value.type);
  if (type === "file") {
    return readFileTarget(value);
  }
  if (type === "url") {
    return readUrlTarget(value);
  }
  if (type === "panel_app") {
    return readPanelAppTarget(value);
  }
  if (type === "json") {
    return readJsonTarget(value);
  }
  return null;
}

export function isChatInlineDisplayLanguage(className?: string): boolean {
  const match = className ? CODE_LANGUAGE_REGEX.exec(className) : null;
  const language = match?.[1]?.toLowerCase();
  return language === INLINE_DISPLAY_LANGUAGE;
}

export function parseChatInlineDisplayDirective(
  rawText: string,
): ChatInlineDisplayViewModel | null {
  const text = rawText.endsWith("\n") ? rawText.slice(0, -1) : rawText;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const target = readInlineDisplayTarget(parsed.target);
  if (!target) {
    return null;
  }
  return {
    target,
    title: readString(parsed.title),
    description: readString(parsed.description),
  };
}

export function getChatInlineDisplayLabel(display: ChatInlineDisplayViewModel): string {
  if (display.title) {
    return display.title;
  }
  if (display.target.type === "file") {
    const segments = display.target.payload.path.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? display.target.payload.path;
  }
  if (display.target.type === "url") {
    return display.target.payload.url;
  }
  if (display.target.type === "panel_app") {
    return display.target.payload.appId;
  }
  return "JSON";
}

export function getChatInlineDisplayDetail(display: ChatInlineDisplayViewModel): string {
  if (display.target.type === "file") {
    return display.target.payload.path;
  }
  if (display.target.type === "url") {
    return display.target.payload.url;
  }
  if (display.target.type === "panel_app") {
    return display.target.payload.appId;
  }
  return JSON.stringify(display.target.payload.value, null, 2);
}
