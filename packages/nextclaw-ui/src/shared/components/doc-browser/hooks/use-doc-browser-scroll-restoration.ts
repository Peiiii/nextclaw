import type { RefObject } from 'react';
import type { DocBrowserTab } from '@/shared/components/doc-browser/doc-browser-context';
import { usePanelAppScrollRestoration } from '@/shared/hooks/use-panel-app-scroll-restoration';

type UseDocBrowserScrollRestorationParams = {
  currentTab?: DocBrowserTab;
  iframeRef: RefObject<HTMLIFrameElement>;
  isEnabled: boolean;
};

export function useDocBrowserScrollRestoration({
  currentTab,
  iframeRef,
  isEnabled,
}: UseDocBrowserScrollRestorationParams) {
  return usePanelAppScrollRestoration({
    currentUrl: currentTab?.currentUrl ?? null,
    iframeRef,
    isEnabled,
    restorationKey: currentTab ? `panel-app:doc-browser:${currentTab.id}` : null,
  });
}
