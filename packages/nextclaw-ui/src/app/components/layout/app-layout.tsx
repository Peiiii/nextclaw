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
import { getPresenter } from "@/app/presenters/app.presenter";
import { resolveUiDocumentTitle } from "@/shared/lib/ui-document-title";

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isOpen, mode } = useDocBrowser();
  useDocLinkInterceptor();
  const { pathname } = useLocation();
  const { language } = useI18n();
  const { isMobile } = useViewportLayout();
  const desktopHostPlatform = getDesktopHostPlatform();

  useEffect(() => {
    document.title = resolveUiDocumentTitle(pathname);
  }, [pathname, language]);

  if (isMobile && desktopHostPlatform !== "win32") {
    return (
      <MobileAppShell pathname={pathname} isDocBrowserOpen={isOpen} docBrowserRenderers={PANEL_APPS_DOC_BROWSER_RENDERERS} topbarLeadingInset={desktopHostPlatform === "darwin" ? "4.75rem" : undefined}>
        {children}
      </MobileAppShell>
    );
  }

  return (
    <DesktopAppShell pathname={pathname} isMobileLayout={isMobile} isDocBrowserOpen={isOpen} docBrowserMode={mode} docBrowserRenderers={PANEL_APPS_DOC_BROWSER_RENDERERS}>
      {children}
    </DesktopAppShell>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const presenter = getPresenter();

  return (
    <DocBrowserProvider manager={presenter.docBrowserManager}>
      <AppLayoutInner>{children}</AppLayoutInner>
    </DocBrowserProvider>
  );
}
