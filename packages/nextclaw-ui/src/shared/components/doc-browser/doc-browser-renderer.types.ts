import type { PointerEvent, ReactNode } from 'react';
import type { DocBrowserContextValue, DocBrowserTab } from './doc-browser-context';
import type { ContextMenuGroup } from '@/shared/components/ui/context-menu/context-menu';

export type DocBrowserCustomTabRenderParams = {
  currentUrl: string;
  open: DocBrowserContextValue['open'];
  openTarget: DocBrowserContextValue['openTarget'];
  refreshIframe: () => void;
  refreshVersion: number;
  tab: DocBrowserTab;
};

export type DocBrowserIframeMessageParams = {
  event: MessageEvent;
  iframe: HTMLIFrameElement | null;
  iframeInstanceId: string;
  tab: DocBrowserTab;
};

export type DocBrowserCustomTabRenderer = {
  getTabMenuGroups?: (params: DocBrowserCustomTabRenderParams) => readonly ContextMenuGroup[];
  getIframeSandbox?: (tab: DocBrowserTab) => string | undefined;
  getTitle?: (tab: DocBrowserTab) => string;
  onIframeMessage?: (params: DocBrowserIframeMessageParams) => void;
  onIframePointerOver?: (event: PointerEvent<HTMLIFrameElement>) => void;
  renderContent?: (params: DocBrowserCustomTabRenderParams) => ReactNode;
  renderIcon?: (tab: DocBrowserTab) => ReactNode;
  renderToolbar?: (params: DocBrowserCustomTabRenderParams) => ReactNode;
  supportsScrollRestoration?: boolean;
};

export type DocBrowserCustomTabRenderers = Record<string, DocBrowserCustomTabRenderer>;
