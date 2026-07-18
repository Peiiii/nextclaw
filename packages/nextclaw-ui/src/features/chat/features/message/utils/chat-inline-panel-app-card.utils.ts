import {
  createPanelAppResourceUri,
  RIGHT_PANEL_PANEL_APP_TAB_KIND,
} from "@/features/right-panel-resources";
import { PANEL_APP_INLINE_HOST_CONTRACT } from "@nextclaw/shared";
import type { DocBrowserTab } from "@/shared/components/doc-browser/doc-browser-context";

export function createFallbackPanelAppContentPath(appId: string): string {
  return `/api/panel-apps/${encodeURIComponent(appId)}/content`;
}

export function createInlinePanelAppCardUrl(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${new URLSearchParams({
    [PANEL_APP_INLINE_HOST_CONTRACT.displayModeSearchParam]:
      PANEL_APP_INLINE_HOST_CONTRACT.displayMode,
    [PANEL_APP_INLINE_HOST_CONTRACT.placementSearchParam]:
      PANEL_APP_INLINE_HOST_CONTRACT.placement,
  }).toString()}`;
}

export function readInlinePanelAppContentHeight(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const message = value as { height?: unknown; type?: unknown };
  return message.type ===
    PANEL_APP_INLINE_HOST_CONTRACT.contentHeightMessageType &&
    typeof message.height === "number" &&
    Number.isFinite(message.height) &&
    message.height > 0
    ? Math.ceil(message.height)
    : null;
}

export function createInlinePanelAppTab(params: {
  appId: string;
  title: string;
  url: string;
}): DocBrowserTab {
  const { appId, title, url } = params;
  return {
    currentUrl: url,
    dedupeKey: `panel-app:${appId}`,
    history: [url],
    historyIndex: 0,
    id: `inline-panel-app:${appId}`,
    kind: RIGHT_PANEL_PANEL_APP_TAB_KIND,
    navVersion: 0,
    resourceUri: createPanelAppResourceUri(appId),
    title,
  };
}
