import { useState, useRef, useCallback, useEffect } from 'react';
import {
  DOCS_DEFAULT_BASE_URL,
  DOC_BROWSER_HOME_TAB_KIND,
  useDocBrowser,
} from './doc-browser-context';
import { normalizeDocUrl } from './utils/doc-browser-url.utils';
import { DocBrowserHomePage } from './doc-browser-home-page';
import type { DocBrowserCustomTabRenderers } from './doc-browser-renderer.types';
import {
  DocBrowserDocsToolbar,
  DocBrowserExternalLink,
  DocBrowserFrameContent,
} from './doc-browser-panel-parts';
import { DocBrowserTabStrip } from './doc-browser-tab-strip';
import { ResizableRightPanel } from '@/shared/components/resizable-right-panel/resizable-right-panel';
import { cn } from '@/shared/lib/utils';
import { GripVertical } from 'lucide-react';

type DocBrowserProps = {
  customTabRenderers?: DocBrowserCustomTabRenderers;
  displayMode?: 'desktop' | 'fullscreen';
};

type FloatingPanelRect = { x: number; y: number; w: number; h: number };
type FloatingPanelResizeEdge = 'left' | 'right' | 'top' | 'bottom' | 'bottom-right';
type FloatingPanelInteraction = {
  kind: 'drag' | 'resize';
  edge?: FloatingPanelResizeEdge;
  startX: number;
  startY: number;
  startRect: FloatingPanelRect;
};

const FLOATING_PANEL_MARGIN = 40;
const FLOATING_PANEL_MIN_WIDTH = 360;
const FLOATING_PANEL_MIN_HEIGHT = 400;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createInitialFloatingPanelRect(): FloatingPanelRect {
  return {
    x: Math.max(FLOATING_PANEL_MARGIN, window.innerWidth - 520),
    y: 80,
    w: 480,
    h: 600,
  };
}

export function DocBrowser({
  customTabRenderers = {},
  displayMode = 'desktop',
}: DocBrowserProps) {
  const {
    isOpen,
    mode,
    tabs,
    activeTabId,
    activeHistory,
    activeHistoryIndex,
    currentTab,
    open,
    openNewTab,
    close,
    toggleMode,
    goBack,
    goForward,
    navigate,
    syncUrl,
    setActiveTab,
    closeTab,
  } = useDocBrowser();

  const [urlInput, setUrlInput] = useState('');
  const [iframeReloadVersion, setIframeReloadVersion] = useState(0);
  const [floatRect, setFloatRect] = useState<FloatingPanelRect>(createInitialFloatingPanelRect);
  const [floatInteraction, setFloatInteraction] = useState<FloatingPanelInteraction | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentUrl = currentTab?.currentUrl ?? DOCS_DEFAULT_BASE_URL;
  const navVersion = currentTab?.navVersion ?? 0;
  const pendingParentDocsUrlRef = useRef<string | null>(null);
  const prevNavVersionRef = useRef(navVersion);
  const isDocsTab = currentTab?.kind === 'docs';
  const isHomeTab = currentTab?.kind === DOC_BROWSER_HOME_TAB_KIND;
  const canGoBack = activeHistoryIndex > 0;
  const canGoForward = activeHistoryIndex < activeHistory.length - 1;
  const customRenderer = currentTab ? customTabRenderers[currentTab.kind] : undefined;

  useEffect(() => {
    if (!isDocsTab) {
      setUrlInput('');
      return;
    }
    try {
      const parsed = new URL(currentUrl);
      setUrlInput(parsed.pathname);
    } catch {
      setUrlInput(currentUrl);
    }
  }, [currentUrl, activeTabId, isDocsTab]);

  // When currentUrl changes without navVersion bump (goBack/goForward),
  // use postMessage to SPA-navigate inside the iframe instead of remounting.
  useEffect(() => {
    if (!isDocsTab) {
      pendingParentDocsUrlRef.current = null;
      return;
    }
    if (navVersion !== prevNavVersionRef.current) {
      prevNavVersionRef.current = navVersion;
      pendingParentDocsUrlRef.current = normalizeDocUrl(currentUrl);
      return;
    }

    if (iframeRef.current?.contentWindow) {
      try {
        const path = new URL(currentUrl).pathname;
        pendingParentDocsUrlRef.current = normalizeDocUrl(currentUrl);
        iframeRef.current.contentWindow.postMessage({ type: 'docs-navigate', path }, '*');
      } catch {
        // ignore postMessage errors
      }
    }
  }, [currentUrl, navVersion, isDocsTab]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!isDocsTab) {
        return;
      }
      if (e.data?.type === 'docs-route-change' && typeof e.data.url === 'string') {
        const eventUrl = normalizeDocUrl(e.data.url);
        if (pendingParentDocsUrlRef.current && eventUrl !== pendingParentDocsUrlRef.current) {
          return;
        }
        pendingParentDocsUrlRef.current = null;
        syncUrl(e.data.url);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [currentUrl, syncUrl, isDocsTab]);

  useEffect(() => {
    if (!currentTab || !customRenderer?.onIframeMessage) {
      return;
    }
    const handler = (event: MessageEvent) => {
      customRenderer.onIframeMessage?.({
        event,
        iframe: iframeRef.current,
        tab: currentTab,
      });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [currentTab, customRenderer]);

  const startFloatDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    setFloatInteraction({
      kind: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      startRect: floatRect,
    });
  }, [floatRect]);

  const startFloatResize = useCallback((edge: FloatingPanelResizeEdge) => (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setFloatInteraction({
      kind: 'resize',
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startRect: floatRect,
    });
  }, [floatRect]);

  useEffect(() => {
    if (!floatInteraction) return;

    const onMove = (event: PointerEvent) => {
      const { startRect, startX, startY } = floatInteraction;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (floatInteraction.kind === 'drag') {
        setFloatRect({
          ...startRect,
          x: clamp(startRect.x + dx, FLOATING_PANEL_MARGIN, window.innerWidth - FLOATING_PANEL_MARGIN - startRect.w),
          y: clamp(startRect.y + dy, FLOATING_PANEL_MARGIN, window.innerHeight - FLOATING_PANEL_MARGIN - startRect.h),
        });
        return;
      }

      if (floatInteraction.edge === 'left' || floatInteraction.edge === 'top') {
        const isLeftEdge = floatInteraction.edge === 'left';
        const fixedEdge = isLeftEdge ? startRect.x + startRect.w : startRect.y + startRect.h;
        const movingEdge = isLeftEdge ? startRect.x + dx : startRect.y + dy;
        const minSize = isLeftEdge ? FLOATING_PANEL_MIN_WIDTH : FLOATING_PANEL_MIN_HEIGHT;
        const nextEdge = clamp(movingEdge, FLOATING_PANEL_MARGIN, fixedEdge - minSize);
        setFloatRect(isLeftEdge ? { ...startRect, x: nextEdge, w: fixedEdge - nextEdge } : { ...startRect, y: nextEdge, h: fixedEdge - nextEdge });
        return;
      }

      const right = clamp(startRect.x + startRect.w + dx, startRect.x + FLOATING_PANEL_MIN_WIDTH, window.innerWidth - FLOATING_PANEL_MARGIN);
      const bottom = clamp(startRect.y + startRect.h + dy, startRect.y + FLOATING_PANEL_MIN_HEIGHT, window.innerHeight - FLOATING_PANEL_MARGIN);
      setFloatRect({
        ...startRect,
        w: floatInteraction.edge === 'bottom' ? startRect.w : right - startRect.x,
        h: floatInteraction.edge === 'right' ? startRect.h : bottom - startRect.y,
      });
    };

    const onEnd = () => setFloatInteraction(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [floatInteraction]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isDocsTab) return;
    const input = urlInput.trim();
    if (!input) return;
    if (input.startsWith('/')) {
      navigate(`${DOCS_DEFAULT_BASE_URL}${input}`);
    } else if (input.startsWith('http')) {
      navigate(input);
    } else {
      navigate(`${DOCS_DEFAULT_BASE_URL}/${input}`);
    }
  }, [urlInput, navigate, isDocsTab]);

  const refreshIframe = useCallback(() => {
    setIframeReloadVersion((version) => version + 1);
  }, []);

  if (!isOpen) return null;

  const isDocked = mode === 'docked';
  const isFullscreen = displayMode === 'fullscreen';
  const customRenderParams = currentTab ? {
    currentUrl,
    open,
    refreshIframe,
    tab: currentTab,
  } : undefined;
  const customToolbar = customRenderParams ? customRenderer?.renderToolbar?.(customRenderParams) : null;
  const customContent = customRenderParams
    ? customRenderer?.renderContent?.(customRenderParams) ?? (isHomeTab ? <DocBrowserHomePage open={open} /> : null)
    : null;
  const iframeSandbox = currentTab
    ? customRenderer?.getIframeSandbox?.(currentTab) ?? 'allow-same-origin allow-scripts allow-popups allow-forms'
    : 'allow-same-origin allow-scripts allow-popups allow-forms';

  const panelContent = (
    <>
      <DocBrowserTabStrip
        tabs={tabs}
        activeTabId={activeTabId}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        isDocked={isDocked}
        isFullscreen={isFullscreen}
        onGoBack={goBack}
        onGoForward={goForward}
        onOpenNewTab={openNewTab}
        onSetActiveTab={setActiveTab}
        onCloseTab={closeTab}
        onClose={close}
        onDragStart={startFloatDrag}
        onToggleMode={toggleMode}
      />

      <DocBrowserDocsToolbar
        isDocsTab={isDocsTab}
        onSubmit={handleUrlSubmit}
        onUrlInputChange={setUrlInput}
        urlInput={urlInput}
      />

      {customToolbar}

      <DocBrowserFrameContent
        activeTabId={activeTabId}
        currentTab={currentTab}
        currentUrl={currentUrl}
        customContent={customContent}
        iframeRef={iframeRef}
        iframeReloadVersion={iframeReloadVersion}
        iframeSandbox={iframeSandbox}
        isDragging={floatInteraction?.kind === 'drag'}
        isResizing={floatInteraction?.kind === 'resize'}
        navVersion={navVersion}
      />

      <DocBrowserExternalLink currentUrl={currentUrl} isDocsTab={isDocsTab} />
    </>
  );

  if (isDocked && !isFullscreen) {
    return (
      <ResizableRightPanel
        data-testid="doc-browser-panel"
        defaultWidth={420}
        minWidth={320}
        maxWidth={860}
      >
        {panelContent}
      </ResizableRightPanel>
    );
  }

  return (
    <div
      data-testid="doc-browser-panel"
      className={cn(
        'flex flex-col bg-white overflow-hidden relative',
        isFullscreen
          ? 'fixed inset-0 z-[9999] h-[100dvh] w-screen rounded-none border-0 shadow-2xl'
          : 'rounded-2xl shadow-2xl border border-gray-200',
      )}
      style={
        isFullscreen
          ? undefined
          : {
              position: 'fixed',
              left: floatRect.x,
              top: floatRect.y,
              width: floatRect.w,
              height: floatRect.h,
              zIndex: 9999,
            }
      }
    >
      {panelContent}

      {!isDocked && !isFullscreen && (
        <>
          <div className="absolute top-0 left-0 h-1.5 w-full cursor-ns-resize z-20 hover:bg-primary/10 transition-colors" data-testid="doc-browser-resize-top" onPointerDown={startFloatResize('top')} />
          <div
            className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize z-20 hover:bg-primary/10 transition-colors"
            data-testid="doc-browser-resize-left"
            onPointerDown={startFloatResize('left')}
          />
          <div
            className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize z-20 hover:bg-primary/10 transition-colors"
            data-testid="doc-browser-resize-right"
            onPointerDown={startFloatResize('right')}
          />
          <div
            className="absolute bottom-0 left-0 h-1.5 w-full cursor-ns-resize z-20 hover:bg-primary/10 transition-colors"
            data-testid="doc-browser-resize-bottom"
            onPointerDown={startFloatResize('bottom')}
          />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-30 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors"
            data-testid="doc-browser-resize-bottom-right"
            onPointerDown={startFloatResize('bottom-right')}
          >
            <GripVertical className="w-3 h-3 rotate-[-45deg]" />
          </div>
        </>
      )}
    </div>
  );
}
