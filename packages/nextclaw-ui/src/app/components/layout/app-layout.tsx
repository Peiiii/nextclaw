import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  DocBrowserProvider,
  useDocBrowser,
} from "@/shared/components/doc-browser/doc-browser-context";
import { useDocLinkInterceptor } from "@/shared/components/doc-browser/use-doc-link-interceptor";
import { useI18n } from "@/app/components/i18n-provider";
import { useViewportLayout } from "@/app/hooks/use-viewport-layout";
import { DesktopAppShell } from "@/platforms/desktop";
import { MobileAppShell } from "@/platforms/mobile";
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

  useEffect(() => {
    document.title = resolveUiDocumentTitle(pathname);
  }, [pathname, language]);

  if (isMobile) {
    return (
      <MobileAppShell pathname={pathname} isDocBrowserOpen={isOpen}>
        {children}
      </MobileAppShell>
    );
  }

  return (
    <DesktopAppShell
      pathname={pathname}
      isDocBrowserOpen={isOpen}
      docBrowserMode={mode}
    >
      {children}
    </DesktopAppShell>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <DocBrowserProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </DocBrowserProvider>
  );
}
