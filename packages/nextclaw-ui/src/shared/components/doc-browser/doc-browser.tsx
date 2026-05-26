import { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react';
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

function getPanelClassName(isFullscreen: boolean): string {
  return cn(
    'flex flex-col bg-white overflow-hidden relative',
    isFullscreen
      ? 'fixed inset-0 z-[9999] h-[100dvh] w-screen rounded-none border-0 shadow-2xl'
      : 'rounded-2xl shadow-2xl border border-gray-200',
  );
}

function getPanelStyle(params: {
  isFullscreen: boolean;
  floatPos: { x: number; y: number };
  floatSize: { w: number; h: number };
}): CSSProperties | undefined {
  const { isFullscreen, floatPos, floatSize } = params;
  if (isFullscreen) return undefined;
  return {
    position: 'fixed',
    left: floatPos.x,
    top: floatPos.y,
    width: floatSize.w,
    height: floatSize.h,
    zIndex: 9999,
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
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [iframeReloadVersion, setIframeReloadVersion] = useState(0);
  const [floatPos, setFloatPos] = useState(() => ({
    x: Math.max(40, window.innerWidth - 520),
    y: 80,
  }));
  const [floatSize, setFloatSize] = useState({ w: 480, h: 600 });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
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
    if (mode === 'floating') {
      setFloatPos((prev) => ({
        x: Math.max(40, window.innerWidth - floatSize.w - 40),
        y: prev.y,
      }));
    }
  }, [mode, floatSize.w]);

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

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (mode !== 'floating') return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: floatPos.x,
      startPosY: floatPos.y,
    };
  }, [mode, floatPos]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setFloatPos({
        x: dragRef.current.startPosX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.startPosY + (e.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const { axis } = (e.currentTarget as HTMLElement).dataset;
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: floatSize.w,
      startH: floatSize.h,
    };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setFloatSize((prev) => ({
        w: axis === 'y' ? prev.w : Math.max(360, resizeRef.current!.startW + (ev.clientX - resizeRef.current!.startX)),
        h: axis === 'x' ? prev.h : Math.max(400, resizeRef.current!.startH + (ev.clientY - resizeRef.current!.startY)),
      }));
    };
    const onUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [floatSize]);

  const onLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = floatSize.w;
    const startPosX = floatPos.x;
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const newW = Math.max(360, startW + delta);
      setFloatSize((prev) => ({ ...prev, w: newW }));
      setFloatPos((prev) => ({ ...prev, x: startPosX - (newW - startW) }));
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [floatSize.w, floatPos.x]);

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
        onDragStart={onDragStart}
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
        isDragging={isDragging}
        isResizing={isResizing}
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
      style={getPanelStyle({ isFullscreen, floatPos, floatSize })}
    >
      {panelContent}

      {!isDocked && !isFullscreen && (
        <>
          <div className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize z-20 hover:bg-primary/10 transition-colors" onMouseDown={onLeftResizeStart} />
          <div className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize z-20 hover:bg-primary/10 transition-colors" onMouseDown={onResizeStart} data-axis="x" />
          <div className="absolute bottom-0 left-0 h-1.5 w-full cursor-ns-resize z-20 hover:bg-primary/10 transition-colors" onMouseDown={onResizeStart} data-axis="y" />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-30 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors"
            onMouseDown={onResizeStart}
          >
            <GripVertical className="w-3 h-3 rotate-[-45deg]" />
          </div>
        </>
      )}
    </div>
  );

  return panel;
}
