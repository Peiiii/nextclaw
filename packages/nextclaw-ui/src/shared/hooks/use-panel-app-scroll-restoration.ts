import { useCallback, useEffect, type RefObject } from "react";
import { PANEL_APP_SCROLL_RESTORATION_CONTRACT } from "@nextclaw/shared";
import { scrollRestorationManager } from "@/shared/lib/navigation-history";

type ScrollTarget =
  | { kind: "document" }
  | { kind: "element"; path: Array<{ index: number; tagName: string }> };

type PanelAppScrollSnapshot = {
  currentUrl: string;
  target: ScrollTarget;
};

type UsePanelAppScrollRestorationParams = {
  currentUrl: string | null;
  iframeRef: RefObject<HTMLIFrameElement>;
  isEnabled: boolean;
  restorationKey: string | null;
};

function isScrollTarget(value: unknown): value is ScrollTarget {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ScrollTarget>;
  if (candidate.kind === "document") return true;
  return candidate.kind === "element"
    && Array.isArray(candidate.path)
    && candidate.path.length > 0
    && candidate.path.length <= 30
    && candidate.path.every((segment) => (
      typeof segment?.index === "number"
      && Number.isInteger(segment.index)
      && segment.index >= 0
      && segment.index <= 1000
      && typeof segment.tagName === "string"
      && segment.tagName.length > 0
      && segment.tagName.length <= 32
    ));
}

function isPanelAppScrollSnapshot(value: unknown): value is PanelAppScrollSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PanelAppScrollSnapshot>;
  return typeof candidate.currentUrl === "string" && isScrollTarget(candidate.target);
}

function isScrollMessage(value: unknown): value is {
  target: ScrollTarget;
  x: number;
  y: number;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<{
    target: unknown;
    type: string;
    version: number;
    x: number;
    y: number;
  }>;
  return candidate.type === PANEL_APP_SCROLL_RESTORATION_CONTRACT.scrollMessageType
    && candidate.version === PANEL_APP_SCROLL_RESTORATION_CONTRACT.version
    && isScrollTarget(candidate.target)
    && typeof candidate.x === "number"
    && Number.isFinite(candidate.x)
    && candidate.x >= 0
    && typeof candidate.y === "number"
    && Number.isFinite(candidate.y)
    && candidate.y >= 0;
}

/** Bridges the Panel App iframe scroll protocol to the shared navigation history. */
export function usePanelAppScrollRestoration({
  currentUrl,
  iframeRef,
  isEnabled,
  restorationKey,
}: UsePanelAppScrollRestorationParams) {
  useEffect(() => {
    if (!currentUrl || !isEnabled || !restorationKey) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || !isScrollMessage(event.data)) {
        return;
      }
      scrollRestorationManager.save(restorationKey, {
        x: event.data.x,
        y: event.data.y,
        payload: { currentUrl, target: event.data.target } satisfies PanelAppScrollSnapshot,
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentUrl, iframeRef, isEnabled, restorationKey]);

  return useCallback(() => {
    if (!currentUrl || !isEnabled || !restorationKey) return;
    const position = scrollRestorationManager.read(restorationKey);
    if (!position || !isPanelAppScrollSnapshot(position.payload) || position.payload.currentUrl !== currentUrl) {
      return;
    }
    iframeRef.current?.contentWindow?.postMessage({
      type: PANEL_APP_SCROLL_RESTORATION_CONTRACT.restoreScrollMessageType,
      version: PANEL_APP_SCROLL_RESTORATION_CONTRACT.version,
      target: position.payload.target,
      x: position.x,
      y: position.y,
    }, "*");
  }, [currentUrl, iframeRef, isEnabled, restorationKey]);
}
