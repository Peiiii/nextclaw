import { useState, useRef, useCallback, useEffect } from 'react';
import {
  DOC_BROWSER_HOME_TAB_KIND,
  getDefaultDocsUrl,
  getDocsUrl,
  type DocBrowserDockControls,
  type DocBrowserDockState,
  type DocBrowserTab,
  useDocBrowser,
} from './doc-browser-context';
import { normalizeDocUrl } from './utils/doc-browser-url.utils';
import { DocBrowserHomePage } from './doc-browser-home-page';
import type { DocBrowserCustomTabRenderers } from './doc-browser-renderer.types';
import {
  DocBrowserAddressToolbar,
  DocBrowserExternalLink,
  DocBrowserFrameContent,
} from './doc-browser-panel-parts';
import { DocBrowserTabStrip } from './doc-browser-tab-strip';
import {
  createInitialFloatingPanelRect,
  moveFloatingPanelRect,
  resizeFloatingPanelRect,
  type FloatingPanelRect,
  type FloatingPanelResizeEdge,
} from './utils/doc-browser-floating-panel.utils';
import { ResizableRightPanel } from '@/shared/components/resizable-right-panel/resizable-right-panel';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';
import { GripVertical } from 'lucide-react';

type DocBrowserProps = {
  customTabRenderers?: DocBrowserCustomTabRenderers;
  displayMode?: 'desktop' | 'fullscreen';
  dockControls?: DocBrowserDockControls;
};

type FloatingPanelInteraction = {
  startX: number;
  startY: number;
  startRect: FloatingPanelRect;
} & (
  | { kind: 'drag' }
  | { kind: 'resize'; edge: FloatingPanelResizeEdge }
);

const DEFAULT_DOCS_IFRAME_SANDBOX = 'allow-same-origin allow-scripts allow-popups allow-forms';

function resolveContentUrlInput(input: string, currentUrl: string): string {
  if (input.startsWith('/')) {
    try {
      return new URL(input, currentUrl).toString();
    } catch {
      return input;
    }
  }
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(input) || input === 'about:blank') {
    return input;
  }
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(input)) {
    return `http://${input}`;
  }
  return `https://${input}`;
}

function resolveIframeSandbox(
  customRenderer: DocBrowserCustomTabRenderers[string] | undefined,
  currentTab: DocBrowserTab | undefined,
): string | undefined {
  if (!currentTab) {
    return DEFAULT_DOCS_IFRAME_SANDBOX;
  }
  const customSandbox = customRenderer?.getIframeSandbox?.(currentTab);
  if (customSandbox !== undefined) {
    return customSandbox;
  }
  return currentTab.kind === 'content' ? undefined : DEFAULT_DOCS_IFRAME_SANDBOX;
}

function useDocBrowserDockAction(
  dockControls: DocBrowserDockControls | undefined,
  currentTab: DocBrowserTab | undefined,
  dockState: DocBrowserDockState | undefined,
) {
  return useCallback(() => {
    if (!dockState?.canDock) {
      return;
    }
    if (dockState.isDocked) {
      if (dockState.removable) {
        dockControls?.unpinTab(currentTab);
      }
      return;
    }
    dockControls?.pinTab(currentTab);
  }, [currentTab, dockControls, dockState]);
}

function useDocBrowserAddressBar({
  activeTabId,
  currentUrl,
  isAddressToolbarTab,
  isContentTab,
  isDocsTab,
  navigate,
}: {
  activeTabId: string;
  currentUrl: string;
  isAddressToolbarTab: boolean;
  isContentTab: boolean;
  isDocsTab: boolean;
  navigate: (url: string) => void;
}) {
  const addressInputKey = `${activeTabId}:${currentUrl}:${isContentTab ? 'content' : 'docs'}`;
  const [draftInput, setDraftInput] = useState<{ key: string; value: string } | null>(null);
  const currentInput = (() => {
    if (!isAddressToolbarTab) {
      return '';
    }
    if (isContentTab) {
      return currentUrl;
    }
    try {
      return new URL(currentUrl).pathname;
    } catch {
      return currentUrl;
    }
  })();
  const urlInput = draftInput?.key === addressInputKey ? draftInput.value : currentInput;
  const setUrlInput = useCallback(
    (value: string) => setDraftInput({ key: addressInputKey, value }),
    [addressInputKey],
  );

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddressToolbarTab) return;
    const input = urlInput.trim();
    if (!input) return;
    if (isDocsTab && input.startsWith('/')) {
      navigate(getDocsUrl(input));
    } else if (isDocsTab && input.startsWith('http')) {
      navigate(input);
    } else if (isDocsTab) {
      navigate(getDocsUrl(`/${input}`));
    } else {
      navigate(resolveContentUrlInput(input, currentUrl));
    }
  }, [currentUrl, isAddressToolbarTab, isDocsTab, navigate, urlInput]);

  return {
    handleUrlSubmit,
    setUrlInput,
    urlInput,
  };
}

export function DocBrowser({ customTabRenderers = {}, displayMode = 'desktop', dockControls }: DocBrowserProps) {
  const {
    isOpen,
    mode,
    tabs,
    activeTabId,
    activeHistory,
    activeHistoryIndex,
    currentTab,
    open,
    openTarget,
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

  const [iframeReloadVersion, setIframeReloadVersion] = useState(0);
  const [floatRect, setFloatRect] = useState<FloatingPanelRect>(createInitialFloatingPanelRect);
  const [floatInteraction, setFloatInteraction] = useState<FloatingPanelInteraction | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentUrl = currentTab?.currentUrl ?? getDefaultDocsUrl();
  const navVersion = currentTab?.navVersion ?? 0;
  const iframeInstanceId = `${activeTabId}:${navVersion}:${iframeReloadVersion}`;
  const pendingParentDocsUrlRef = useRef<string | null>(null);
  const prevNavVersionRef = useRef(navVersion);
  const isDocsTab = currentTab?.kind === 'docs';
  const isHomeTab = currentTab?.kind === DOC_BROWSER_HOME_TAB_KIND;
  const canGoBack = activeHistoryIndex > 0;
  const canGoForward = activeHistoryIndex < activeHistory.length - 1;
  const customRenderer = currentTab ? customTabRenderers[currentTab.kind] : undefined;
  const dockState = dockControls?.getDockState(currentTab);
  const isContentTab = currentTab?.kind === 'content';
  const isAddressToolbarTab = isDocsTab || isContentTab;
  const { handleUrlSubmit, setUrlInput, urlInput } = useDocBrowserAddressBar({
    activeTabId,
    currentUrl,
    isAddressToolbarTab,
    isContentTab,
    isDocsTab,
    navigate,
  });

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
        iframeInstanceId,
        tab: currentTab,
      });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [currentTab, customRenderer, iframeInstanceId]);

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
        setFloatRect(moveFloatingPanelRect(startRect, dx, dy));
        return;
      }

      setFloatRect(resizeFloatingPanelRect(floatInteraction.edge, startRect, dx, dy));
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

  const refreshIframe = useCallback(() => {
    setIframeReloadVersion((version) => version + 1);
  }, []);

  const handleToggleDock = useDocBrowserDockAction(dockControls, currentTab, dockState);

  if (!isOpen) return null;

  const isDocked = mode === 'docked';
  const isFullscreen = displayMode === 'fullscreen';
  const customRenderParams = currentTab ? {
    currentUrl,
    open,
    openTarget,
    refreshIframe,
    tab: currentTab,
  } : undefined;
  const customToolbar = customRenderParams ? customRenderer?.renderToolbar?.(customRenderParams) : null;
  const customContent = customRenderParams
    ? customRenderer?.renderContent?.(customRenderParams) ?? (isHomeTab ? <DocBrowserHomePage /> : null)
    : null;
  const iframeSandbox = resolveIframeSandbox(customRenderer, currentTab);

  const panelContent = (
    <>
      <DocBrowserTabStrip
        tabs={tabs}
        activeTabId={activeTabId}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        dockState={dockState}
        isDocked={isDocked}
        isFullscreen={isFullscreen}
        onGoBack={goBack}
        onGoForward={goForward}
        onOpenNewTab={openNewTab}
        onToggleDock={handleToggleDock}
        onSetActiveTab={setActiveTab}
        onCloseTab={closeTab}
        onClose={close}
        onDragStart={startFloatDrag}
        onToggleMode={toggleMode}
      />

      <DocBrowserAddressToolbar
        isVisible={isAddressToolbarTab}
        onRefresh={refreshIframe}
        onSubmit={handleUrlSubmit}
        onUrlInputChange={setUrlInput}
        placeholder={isDocsTab ? t('docBrowserSearchPlaceholder') : t('docBrowserAddressPlaceholder')}
        urlInput={urlInput}
      />

      {customToolbar}

      <DocBrowserFrameContent
        currentTab={currentTab}
        currentUrl={currentUrl}
        customContent={customContent}
        iframeRef={iframeRef}
        iframeInstanceId={iframeInstanceId}
        iframeSandbox={iframeSandbox}
        isDragging={floatInteraction?.kind === 'drag'}
        isResizing={floatInteraction?.kind === 'resize'}
      />

      <DocBrowserExternalLink currentUrl={currentUrl} isVisible={isDocsTab || isContentTab} />
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
        'relative flex flex-col overflow-hidden bg-card text-card-foreground',
        isFullscreen
          ? 'fixed inset-0 z-[var(--z-floating-panel)] h-[100dvh] w-screen rounded-none border-0 shadow-2xl'
          : 'rounded-2xl border border-border shadow-2xl',
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
              zIndex: 'var(--z-floating-panel)',
            }
      }
    >
      {panelContent}

      {!isDocked && !isFullscreen && (
        <>
          <div className="absolute top-0 left-0 h-3 w-full cursor-ns-resize z-20 hover:bg-primary/10 transition-colors" data-testid="doc-browser-resize-top" onPointerDown={startFloatResize('top')} />
          <div
            className="absolute top-0 left-0 w-3 h-full cursor-ew-resize z-20 hover:bg-primary/10 transition-colors"
            data-testid="doc-browser-resize-left"
            onPointerDown={startFloatResize('left')}
          />
          <div
            className="absolute top-0 right-0 w-3 h-full cursor-ew-resize z-20 hover:bg-primary/10 transition-colors"
            data-testid="doc-browser-resize-right"
            onPointerDown={startFloatResize('right')}
          />
          <div
            className="absolute bottom-0 left-0 h-3 w-full cursor-ns-resize z-20 hover:bg-primary/10 transition-colors"
            data-testid="doc-browser-resize-bottom"
            onPointerDown={startFloatResize('bottom')}
          />
          <div
            className="absolute top-0 left-0 z-30 h-4 w-4 cursor-nw-resize hover:bg-primary/10 transition-colors"
            data-testid="doc-browser-resize-top-left"
            onPointerDown={startFloatResize('top-left')}
          />
          <div
            className="absolute top-0 right-0 z-30 h-4 w-4 cursor-ne-resize hover:bg-primary/10 transition-colors"
            data-testid="doc-browser-resize-top-right"
            onPointerDown={startFloatResize('top-right')}
          />
          <div
            className="absolute bottom-0 left-0 z-30 h-4 w-4 cursor-sw-resize hover:bg-primary/10 transition-colors"
            data-testid="doc-browser-resize-bottom-left"
            onPointerDown={startFloatResize('bottom-left')}
          />
          <div
            className="absolute bottom-0 right-0 z-30 flex h-4 w-4 cursor-se-resize items-center justify-center text-muted-foreground/45 transition-colors hover:text-muted-foreground"
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
