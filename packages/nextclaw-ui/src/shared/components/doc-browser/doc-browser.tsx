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
import { useDocBrowserScrollRestoration } from './hooks/use-doc-browser-scroll-restoration';
import type { DocBrowserCustomTabRenderers } from './doc-browser-renderer.types';
import {
  DocBrowserAddressToolbar,
  DocBrowserExternalLink,
  DocBrowserFrameContent,
} from './doc-browser-panel-parts';
import { DocBrowserTabStrip } from './doc-browser-tab-strip';
import { WorkbenchSurface } from '@/shared/components/workbench/workbench-surface';
import { GLOBAL_WORKBENCH_SURFACE } from '@/shared/components/workbench/types/workbench-surface.types';
import { getAppPresenter } from '@/app/presenters/app.presenter';
import { t } from '@/shared/lib/i18n';
import type { ContextMenuGroup } from '@/shared/components/ui/context-menu/context-menu';
import {
  DOC_BROWSER_DOCKED_MAX_WIDTH,
  DOC_BROWSER_DOCKED_MIN_WIDTH,
} from '@/shared/components/doc-browser/utils/doc-browser-state.utils';

type DocBrowserProps = {
  customTabRenderers?: DocBrowserCustomTabRenderers;
  displayMode?: 'desktop' | 'fullscreen';
  dockControls?: DocBrowserDockControls;
  getTabMenuGroups?: (tab: DocBrowserTab) => readonly ContextMenuGroup[] | undefined;
};

export type DocBrowserTabMenuGroupsResolver = NonNullable<DocBrowserProps['getTabMenuGroups']>;




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

export function DocBrowser({
  customTabRenderers = {},
  displayMode = 'desktop',
  dockControls,
  getTabMenuGroups,
}: DocBrowserProps) {
  const {
    isOpen,
    dockedWidth,
    tabs,
    activeTabId,
    activeHistory,
    activeHistoryIndex,
    currentTab,
    open,
    openTarget,
    openNewTab,
    close,
    setDockedWidth,
    goBack,
    goForward,
    navigate,
    syncUrl,
    setActiveTab,
    closeTab,
  } = useDocBrowser();

  const [iframeReloadVersion, setIframeReloadVersion] = useState(0);
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
  const supportsScrollRestoration = customRenderer?.supportsScrollRestoration === true;
  const restoreScroll = useDocBrowserScrollRestoration({
    currentTab,
    iframeRef,
    isEnabled: supportsScrollRestoration,
  });
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
      if (!isDocsTab || e.source !== iframeRef.current?.contentWindow) {
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

  const refreshIframe = useCallback(() => {
    setIframeReloadVersion((version) => version + 1);
  }, []);

  const handleToggleDock = useDocBrowserDockAction(dockControls, currentTab, dockState);


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
  const iframeSandbox = currentTab ? customRenderer?.getIframeSandbox?.(currentTab) : undefined;

  const panelContent = (
    <>


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
        isDragging={false}
        isResizing={false}
        onIframeLoad={restoreScroll}
        onIframePointerOver={customRenderer?.onIframePointerOver}
      />

      <DocBrowserExternalLink currentUrl={currentUrl} isVisible={isDocsTab || isContentTab} />
    </>
  );

  return (
    <WorkbenchSurface id={GLOBAL_WORKBENCH_SURFACE} manager={getAppPresenter().workbenchSurfaceManager}
      title={currentTab?.title || t('workbenchGlobalGroup')} testId="doc-browser-panel"
      width={dockedWidth} minWidth={DOC_BROWSER_DOCKED_MIN_WIDTH} maxWidth={DOC_BROWSER_DOCKED_MAX_WIDTH}
      onWidthCommit={setDockedWidth} onClose={close} closeLabel={t('workbenchHideGroup')}
      hidden={!isOpen} fullscreen={isFullscreen} navigation={
      <DocBrowserTabStrip
        tabs={tabs}
        activeTabId={activeTabId}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        dockState={dockState}
        onGoBack={goBack}
        onGoForward={goForward}
        onOpenNewTab={openNewTab}
        onToggleDock={handleToggleDock}
        onSetActiveTab={setActiveTab}
        onCloseTab={closeTab}
        getTabMenuGroups={getTabMenuGroups}
      />
      }>
      {panelContent}
    </WorkbenchSurface>
  );
}
