import type { UiContentParams } from "../types/ui-show-content.types.js";
import { readUiContentParams } from "../utils/ui-content-params.utils.js";

/** Public conversation identity, shared by tool results and every UI placement. */
export function createSessionResourceUri(sessionId: string): string {
  if (!sessionId.trim()) throw new Error("Session ID must not be empty");
  return `nextclaw://sessions/${encodeURIComponent(sessionId)}`;
}

/** Historical message links are accepted only here and normalized by callers. */
export function parseSessionResourceUri(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== "nextclaw:" || url.username || url.password || url.port || url.search || url.hash) return null;
    const match = /^\/([^/]+)$/.exec(url.pathname);
    if (url.hostname === "sessions" && match) {
      const id = decodeURIComponent(match[1]);
      return id.trim() ? id : null;
    }
    if (url.hostname === "chat-session" && match) {
      const value = decodeURIComponent(match[1]);
      if (!value.startsWith("sid_")) return value.trim() ? value : null;
      const encoded = value.slice(4);
      if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
      const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
      const id = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
      return id.trim() ? id : null;
    }
    if (url.hostname === "objects") {
      const legacy = /^\/(?:chat-session|chat-sessions)\/([^/]+)$/.exec(url.pathname);
      const id = legacy ? decodeURIComponent(legacy[1]) : null;
      return id?.trim() ? id : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Canonical Panel App identity in the NextClaw Resource Protocol; placement is not identity. */
export function createPanelAppResourceUri(appId: string, sourcePath?: string): string {
  const uri = `nextclaw://panel-app/${encodeURIComponent(appId)}`;
  const path = sourcePath?.trim();
  return path ? `${uri}?${new URLSearchParams({ path }).toString()}` : uri;
}

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
