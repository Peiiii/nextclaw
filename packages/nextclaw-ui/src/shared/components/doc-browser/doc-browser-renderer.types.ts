import type { ReactNode } from 'react';
import type { DocBrowserContextValue, DocBrowserTab } from './doc-browser-context';

export type DocBrowserCustomTabRenderParams = {
  currentUrl: string;
  open: DocBrowserContextValue['open'];
  openTarget: DocBrowserContextValue['openTarget'];
  refreshIframe: () => void;
  tab: DocBrowserTab;
};

export type DocBrowserIframeMessageParams = {
  event: MessageEvent;
  iframe: HTMLIFrameElement | null;
  iframeInstanceId: string;
  tab: DocBrowserTab;
};

export type DocBrowserCustomTabRenderer = {
  getIframeSandbox?: (tab: DocBrowserTab) => string;
  getTitle?: (tab: DocBrowserTab) => string;
  onIframeMessage?: (params: DocBrowserIframeMessageParams) => void;
  renderContent?: (params: DocBrowserCustomTabRenderParams) => ReactNode;
  renderIcon?: (tab: DocBrowserTab) => ReactNode;
  renderToolbar?: (params: DocBrowserCustomTabRenderParams) => ReactNode;
};

export type DocBrowserCustomTabRenderers = Record<string, DocBrowserCustomTabRenderer>;
