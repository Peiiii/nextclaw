import type { UiContentParams } from "../types/ui-show-content.types.js";
import { readUiContentParams } from "../utils/ui-content-params.utils.js";

export const CHAT_UI_RESOURCE_TOKEN_KIND = "ui_resource";

const UI_RESOURCE_KIND_MAX_LENGTH = 80;
const UI_RESOURCE_TITLE_MAX_LENGTH = 512;
const UI_RESOURCE_URI_MAX_LENGTH = 8_192;

export type ChatUiResourceReference = {
  uri: string;
  resourceKind: string;
  title: string;
  currentUrl: string;
  contentParams?: UiContentParams;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readBoundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

export function readChatUiResourceReference(
  value: unknown,
): ChatUiResourceReference | null {
  if (!isRecord(value)) return null;
  const uri = readBoundedString(value.uri, UI_RESOURCE_URI_MAX_LENGTH);
  const resourceKind = readBoundedString(
    value.resourceKind,
    UI_RESOURCE_KIND_MAX_LENGTH,
  );
  const title = readBoundedString(value.title, UI_RESOURCE_TITLE_MAX_LENGTH);
  const currentUrl = readBoundedString(
    value.currentUrl,
    UI_RESOURCE_URI_MAX_LENGTH,
  );
  if (!uri || !resourceKind || !title || !currentUrl) return null;
  try {
    const contentParams = readUiContentParams(value.contentParams);
    return {
      uri,
      resourceKind,
      title,
      currentUrl,
      ...(contentParams ? { contentParams: structuredClone(contentParams) } : {}),
    };
  } catch {
    return null;
  }
}
