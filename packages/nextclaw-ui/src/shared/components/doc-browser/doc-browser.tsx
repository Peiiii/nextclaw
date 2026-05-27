import { useState, useRef, useCallback, useEffect } from 'react';
import {
  DOCS_DEFAULT_BASE_URL,
  useDocBrowser,
} from './doc-browser-context';
import type { DocBrowserCustomTabRenderers } from './doc-browser-renderer.types';
import {
  DocBrowserDocsToolbar,
  DocBrowserExternalLink,
  DocBrowserFrameContent,
  DocBrowserPanelHeader,
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
type FloatingPanelResizeEdge = 'left' | 'right' | 'bottom' | 'bottom-right';
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

function getPanelClassName(isFullscreen: boolean): string {
  return cn(
    'flex flex-col bg-white overflow-hidden relative',
    isFullscreen
      ? 'fixed inset-0 z-[9999] h-[100dvh] w-screen rounded-none border-0 shadow-2xl'
      : 'rounded-2xl shadow-2xl border border-gray-200',
  );
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
    currentTab,
    open,
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
  const [floatRect, setFloatRect] = useState<FloatingPanelRect>(() => ({
    x: Math.max(FLOATING_PANEL_MARGIN, window.innerWidth - 520),
    y: 80,
    w: 480,
    h: 600,
  }));
  const [floatInteraction, setFloatInteraction] = useState<FloatingPanelInteraction | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentUrl = currentTab?.currentUrl ?? DOCS_DEFAULT_BASE_URL;
  const navVersion = currentTab?.navVersion ?? 0;
  const prevNavVersionRef = useRef(navVersion);
  const isDocsTab = currentTab?.kind === 'docs';

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
      return;
    }
    if (navVersion !== prevNavVersionRef.current) {
      prevNavVersionRef.current = navVersion;
      return;
    }

    if (iframeRef.current?.contentWindow) {
      try {
        const path = new URL(currentUrl).pathname;
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
        syncUrl(e.data.url);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [syncUrl, isDocsTab]);

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

      if (floatInteraction.edge === 'left') {
        const right = startRect.x + startRect.w;
        const x = clamp(startRect.x + dx, FLOATING_PANEL_MARGIN, right - FLOATING_PANEL_MIN_WIDTH);
        setFloatRect({ ...startRect, x, w: right - x });
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
  const customRenderer = currentTab ? customTabRenderers[currentTab.kind] : undefined;
  const customRenderParams = currentTab ? {
    currentUrl,
    open,
    refreshIframe,
    tab: currentTab,
  } : undefined;
  const customToolbar = customRenderParams ? customRenderer?.renderToolbar?.(customRenderParams) : null;
  const customContent = customRenderParams ? customRenderer?.renderContent?.(customRenderParams) : null;
  const iframeSandbox = currentTab
    ? customRenderer?.getIframeSandbox?.(currentTab) ?? 'allow-same-origin allow-scripts allow-popups allow-forms'
    : 'allow-same-origin allow-scripts allow-popups allow-forms';

  const panelContent = (
    <>
      <DocBrowserPanelHeader
        currentTab={currentTab}
        customRenderer={customRenderer}
        isDocked={isDocked}
        isFullscreen={isFullscreen}
        onClose={close}
        onDragStart={startFloatDrag}
        onToggleMode={toggleMode}
      />

      <DocBrowserTabStrip
        tabs={tabs}
        activeTabId={activeTabId}
        onOpenDocs={() => open(undefined, { kind: 'docs', newTab: true, title: 'Docs' })}
        onSetActiveTab={setActiveTab}
        onCloseTab={closeTab}
      />

      <DocBrowserDocsToolbar
        currentTab={currentTab}
        isDocsTab={isDocsTab}
        onBack={goBack}
        onForward={goForward}
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

  const panel = (
    <div
      data-testid="doc-browser-panel"
      className={getPanelClassName(isFullscreen)}
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

  return panel;
}
