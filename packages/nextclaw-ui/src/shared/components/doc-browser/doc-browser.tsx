import { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react';
import { DOCS_DEFAULT_BASE_URL, isDocsUrl, useDocBrowser } from './doc-browser-context';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';
import {
  ArrowLeft,
  ArrowRight,
  X,
  ExternalLink,
  PanelRightOpen,
  Maximize2,
  GripVertical,
  Search,
  BookOpen,
  Plus,
} from 'lucide-react';

/**
 * DocBrowser — An in-app micro-browser for documentation.
 *
 * Supports:
 * - multi-tab browsing
 * - `docked`: right sidebar panel (horizontally resizable)
 * - `floating`: draggable, resizable overlay
 * - `fullscreen`: full viewport overlay for narrow mobile shells
 */
type DocBrowserProps = {
  displayMode?: 'desktop' | 'fullscreen';
};

function getPanelClassName(isFullscreen: boolean, isDocked: boolean): string {
  return cn(
    'flex flex-col bg-white overflow-hidden relative',
    isFullscreen
      ? 'fixed inset-0 z-[9999] h-[100dvh] w-screen rounded-none border-0 shadow-2xl'
      : isDocked
        ? 'h-full border-l border-gray-200 shrink-0'
        : 'rounded-2xl shadow-2xl border border-gray-200',
  );
}

function getPanelStyle(params: {
  isFullscreen: boolean;
  isDocked: boolean;
  dockedWidth: number;
  floatPos: { x: number; y: number };
  floatSize: { w: number; h: number };
}): CSSProperties | undefined {
  const { isFullscreen, isDocked, dockedWidth, floatPos, floatSize } = params;
  if (isFullscreen) return undefined;
  if (isDocked) return { width: dockedWidth };
  return {
    position: 'fixed',
    left: floatPos.x,
    top: floatPos.y,
    width: floatSize.w,
    height: floatSize.h,
    zIndex: 9999,
  };
}

export function DocBrowser({ displayMode = 'desktop' }: DocBrowserProps) {
  const {
    isOpen,
    mode,
    tabs,
    activeTabId,
    currentTab,
    currentUrl,
    navVersion,
    close,
    toggleMode,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    navigate,
    syncUrl,
    setActiveTab,
    closeTab,
    openNewTab,
  } = useDocBrowser();

  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [floatPos, setFloatPos] = useState(() => ({
    x: Math.max(40, window.innerWidth - 520),
    y: 80,
  }));
  const [floatSize, setFloatSize] = useState({ w: 480, h: 600 });
  const [dockedWidth, setDockedWidth] = useState(420);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const dockResizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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
    const axis = (e.currentTarget as HTMLElement).dataset.axis;
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

  const onDockResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    dockResizeRef.current = { startX: e.clientX, startW: dockedWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dockResizeRef.current) return;
      const delta = dockResizeRef.current.startX - ev.clientX;
      setDockedWidth(Math.max(320, Math.min(860, dockResizeRef.current.startW + delta)));
    };
    const onUp = () => {
      setIsResizing(false);
      dockResizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dockedWidth]);

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

  if (!isOpen) return null;

  const isDocked = mode === 'docked';
  const isFullscreen = displayMode === 'fullscreen';
  const canDragPanel = !isDocked && !isFullscreen;

  const panel = (
    <div
      data-testid="doc-browser-panel"
      className={getPanelClassName(isFullscreen, isDocked)}
      style={getPanelStyle({ isFullscreen, isDocked, dockedWidth, floatPos, floatSize })}
    >
      {isDocked && !isFullscreen && (
        <div
          className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize z-20 hover:bg-primary/10 transition-colors"
          onMouseDown={onDockResizeStart}
        />
      )}

      <div
        className={cn(
          'flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 shrink-0 select-none',
          canDragPanel && 'cursor-grab active:cursor-grabbing',
          isFullscreen && 'pt-[calc(env(safe-area-inset-top,0px)+0.625rem)]',
        )}
        onMouseDown={canDragPanel ? onDragStart : undefined}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpen className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-gray-900 truncate">{t('docBrowserTitle')}</span>
        </div>
        <div className="flex items-center gap-1">
          {!isFullscreen ? (
            <button
              onClick={toggleMode}
              className="hover:bg-gray-200 rounded-md p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
              title={isDocked ? t('docBrowserFloatMode') : t('docBrowserDockMode')}
            >
              {isDocked ? <Maximize2 className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            </button>
          ) : null}
          <button
            onClick={close}
            className="hover:bg-gray-200 rounded-md p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            title={t('docBrowserClose')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-2.5 py-2 bg-white border-b border-gray-100 overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                'inline-flex items-center gap-1 h-7 px-1.5 rounded-lg text-xs border max-w-[220px] shrink-0 transition-colors',
                isActive
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              )}
            >
              <button
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="truncate text-left px-1"
                title={tab.title}
              >
                {tab.title || t('docBrowserTabUntitled')}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                className="rounded p-0.5 hover:bg-black/10"
                aria-label={t('docBrowserCloseTab')}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        <button
          onClick={() => openNewTab(undefined, { kind: 'docs', title: 'Docs' })}
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 shrink-0"
          title={t('docBrowserNewTab')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {isDocsTab && (
        <div className="flex items-center gap-2 px-3.5 py-2 bg-white border-b border-gray-100 shrink-0">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <form onSubmit={handleUrlSubmit} className="flex-1 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={t('docBrowserSearchPlaceholder')}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors placeholder:text-gray-400"
            />
          </form>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        <iframe
          ref={iframeRef}
          key={`${activeTabId}:${navVersion}`}
          src={currentUrl}
          className="absolute inset-0 w-full h-full border-0"
          title={currentTab?.title || 'NextClaw Docs'}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          allow="clipboard-read; clipboard-write"
        />
        {(isResizing || isDragging) && (
          <div className="absolute inset-0 z-10" />
        )}
      </div>

      {isDocsTab && isDocsUrl(currentUrl) && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 shrink-0">
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-doc-external
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover font-medium transition-colors"
          >
            {t('docBrowserOpenExternal')}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

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
