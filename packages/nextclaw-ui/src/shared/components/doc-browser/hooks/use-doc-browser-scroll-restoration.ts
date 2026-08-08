import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { PANEL_APP_SCROLL_RESTORATION_CONTRACT } from '@nextclaw/shared';
import type { DocBrowserTab } from '@/shared/components/doc-browser/doc-browser-context';

type ScrollTarget =
  | { kind: 'document' }
  | { kind: 'element'; path: Array<{ index: number; tagName: string }> };

type ScrollPosition = {
  currentUrl: string;
  target: ScrollTarget;
  x: number;
  y: number;
};

type UseDocBrowserScrollRestorationParams = {
  currentTab?: DocBrowserTab;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  isEnabled: boolean;
  tabs: DocBrowserTab[];
};

function isScrollTarget(value: unknown): value is ScrollTarget {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ScrollTarget>;
  if (candidate.kind === 'document') {
    return true;
  }
  return candidate.kind === 'element'
    && Array.isArray(candidate.path)
    && candidate.path.length > 0
    && candidate.path.length <= 30
    && candidate.path.every((segment) => (
      typeof segment?.index === 'number'
      && Number.isInteger(segment.index)
      && segment.index >= 0
      && segment.index <= 1000
      && typeof segment.tagName === 'string'
      && segment.tagName.length > 0
      && segment.tagName.length <= 32
    ));
}

function isScrollMessage(value: unknown): value is {
  target: ScrollTarget;
  type: string;
  version: number;
  x: number;
  y: number;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }
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
    && typeof candidate.x === 'number'
    && Number.isFinite(candidate.x)
    && candidate.x >= 0
    && typeof candidate.y === 'number'
    && Number.isFinite(candidate.y)
    && candidate.y >= 0;
}

export function useDocBrowserScrollRestoration({
  currentTab,
  iframeRef,
  isEnabled,
  tabs,
}: UseDocBrowserScrollRestorationParams) {
  const positionsRef = useRef(new Map<string, ScrollPosition>());

  useEffect(() => {
    const activeTabIds = new Set(tabs.map((tab) => tab.id));
    for (const tabId of positionsRef.current.keys()) {
      if (!activeTabIds.has(tabId)) {
        positionsRef.current.delete(tabId);
      }
    }
  }, [tabs]);

  useEffect(() => {
    if (!currentTab || !isEnabled) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || !isScrollMessage(event.data)) {
        return;
      }
      positionsRef.current.set(currentTab.id, {
        currentUrl: currentTab.currentUrl,
        target: event.data.target,
        x: event.data.x,
        y: event.data.y,
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [currentTab, iframeRef, isEnabled]);

  return useCallback(() => {
    if (!currentTab || !isEnabled) {
      return;
    }
    const position = positionsRef.current.get(currentTab.id);
    if (!position || position.currentUrl !== currentTab.currentUrl) {
      return;
    }
    iframeRef.current?.contentWindow?.postMessage({
      type: PANEL_APP_SCROLL_RESTORATION_CONTRACT.restoreScrollMessageType,
      version: PANEL_APP_SCROLL_RESTORATION_CONTRACT.version,
      target: position.target,
      x: position.x,
      y: position.y,
    }, '*');
  }, [currentTab, iframeRef, isEnabled]);
}
