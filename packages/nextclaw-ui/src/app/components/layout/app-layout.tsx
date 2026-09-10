import { ChatResourceLinkProvider } from '@nextclaw/agent-chat-ui';
import { PageResourceIcon } from '@/features/right-panel-resources';
import { usePageResourceActions } from '@/features/right-panel-resources';
import { pageResourceFromTab } from '@/features/right-panel-resources';
import { PAGE_RESOURCE_RENDERERS } from '@/app/configs/page-resource-renderers.config';
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  DocBrowserProvider,
  useDocBrowser,
} from "@/shared/components/doc-browser/doc-browser-context";
import { useDocLinkInterceptor } from "@/shared/components/doc-browser/use-doc-link-interceptor";
import { useI18n } from "@/app/components/i18n-provider";
import { useViewportLayout } from "@/app/hooks/use-viewport-layout";
import { DesktopAppShell, getDesktopHostPlatform } from "@/platforms/desktop";
import { MobileAppShell } from "@/platforms/mobile";
import {
  SideDock,
  type SideDockManager,
  useSideDockStore,
} from "@/features/side-dock";
import { getPresenter } from "@/app/presenters/app.presenter";
import { resolveUiDocumentTitle } from "@/shared/lib/ui-document-title";
import type { DocBrowserDockControls } from "@/shared/components/doc-browser/doc-browser-context";
import type { DocBrowserTabMenuGroupsResolver } from "@/shared/components/doc-browser/doc-browser";

interface AppLayoutProps {
  children: React.ReactNode;
}

const renderResourceIcon = (uri: string) => <PageResourceIcon uri={uri} />;

function AppLayoutInner({
  children,
  sideDockManager,
}: AppLayoutProps & { sideDockManager: SideDockManager }) {
  const { isOpen, mode } = useDocBrowser();
  useDocLinkInterceptor();
  const { pathname } = useLocation();
  const { language } = useI18n();
  const { isMobile } = useViewportLayout();
  const desktopHostPlatform = getDesktopHostPlatform();
  const isSideDockVisible = useSideDockStore((state) => state.isVisible);
  useSideDockStore((state) => state.pinnedItems);
  const docBrowserDockControls: DocBrowserDockControls = {
    getDockState: sideDockManager.getDockState,
    pinTab: sideDockManager.pinTab,
    unpinTab: sideDockManager.unpinTab,
  };
  const pageActions = usePageResourceActions();
  const getDocBrowserTabMenuGroups: DocBrowserTabMenuGroupsResolver = (tab) => pageActions(pageResourceFromTab(tab), 'global');

  useEffect(() => {
    document.title = resolveUiDocumentTitle(pathname, window.location);
  }, [pathname, language]);

  if (isMobile && desktopHostPlatform !== "win32") {
    return (
      <MobileAppShell
        pathname={pathname}
        isDocBrowserOpen={isOpen}
        docBrowserDockControls={docBrowserDockControls}
        docBrowserRenderers={PAGE_RESOURCE_RENDERERS}
        docBrowserTabMenuGroups={getDocBrowserTabMenuGroups}
        topbarLeadingInset={
          desktopHostPlatform === "darwin" ? "4.75rem" : undefined
        }
      >
        {children}
      </MobileAppShell>
    );
  }

  return (
    <DesktopAppShell
      pathname={pathname}
      isMobileLayout={isMobile}
      isDocBrowserOpen={isOpen}
      docBrowserMode={mode}
      docBrowserDockControls={docBrowserDockControls}
      docBrowserRenderers={PAGE_RESOURCE_RENDERERS}
      docBrowserTabMenuGroups={getDocBrowserTabMenuGroups}
      sideDock={isSideDockVisible ? <SideDock manager={sideDockManager} getItemMenuGroups={(item) => {
        const page = getPresenter().pageResourceManager.resolve(item.target.type === 'right-panel-resource' ? item.target.uri : item.target.url);
        return page ? pageActions(page) : [];
      }} /> : null}
    >
      {children}
    </DesktopAppShell>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const presenter = getPresenter();

  return (
    <DocBrowserProvider manager={presenter.docBrowserManager}>
      <ChatResourceLinkProvider renderIcon={renderResourceIcon}><AppLayoutInner sideDockManager={presenter.sideDockManager}>
        {children}
      </AppLayoutInner>
    </ChatResourceLinkProvider></DocBrowserProvider>
  );
}
