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
import { PANEL_APPS_DOC_BROWSER_RENDERERS } from "@/features/panel-apps";
import { MARKETPLACE_DETAIL_DOC_BROWSER_RENDERERS } from "@/features/marketplace";
import {
  SideDock,
  type SideDockManager,
  useSideDockStore,
} from "@/features/side-dock";
import { getPresenter } from "@/app/presenters/app.presenter";
import { resolveUiDocumentTitle } from "@/shared/lib/ui-document-title";
import type { DocBrowserDockControls } from "@/shared/components/doc-browser/doc-browser-context";

interface AppLayoutProps {
  children: React.ReactNode;
}

const DOC_BROWSER_RENDERERS = {
  ...PANEL_APPS_DOC_BROWSER_RENDERERS,
  ...MARKETPLACE_DETAIL_DOC_BROWSER_RENDERERS,
};

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

  useEffect(() => {
    document.title = resolveUiDocumentTitle(pathname, window.location);
  }, [pathname, language]);

  if (isMobile && desktopHostPlatform !== "win32") {
    return (
      <MobileAppShell
        pathname={pathname}
        isDocBrowserOpen={isOpen}
        docBrowserDockControls={docBrowserDockControls}
        docBrowserRenderers={DOC_BROWSER_RENDERERS}
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
      docBrowserRenderers={DOC_BROWSER_RENDERERS}
      sideDock={isSideDockVisible ? <SideDock manager={sideDockManager} /> : null}
    >
      {children}
    </DesktopAppShell>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const presenter = getPresenter();

  return (
    <DocBrowserProvider manager={presenter.docBrowserManager}>
      <AppLayoutInner sideDockManager={presenter.sideDockManager}>
        {children}
      </AppLayoutInner>
    </DocBrowserProvider>
  );
}
