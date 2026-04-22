import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./sidebar";
import {
  DocBrowserProvider,
  useDocBrowser,
} from "@/shared/components/doc-browser/doc-browser-context";
import { useDocLinkInterceptor } from "@/shared/components/doc-browser/use-doc-link-interceptor";
import { useI18n } from "@/app/components/providers/i18n-provider";
import { resolveUiDocumentTitle } from "@/shared/lib/ui-document-title";

const DocBrowser = lazy(async () => ({
  default: (await import("@/shared/components/doc-browser/doc-browser")).DocBrowser,
}));

interface AppLayoutProps {
  children: React.ReactNode;
}

function isMainWorkspaceRoute(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return (
    normalized === "/chat" ||
    normalized.startsWith("/chat/") ||
    normalized === "/skills" ||
    normalized.startsWith("/skills/") ||
    normalized === "/cron" ||
    normalized.startsWith("/cron/") ||
    normalized === "/agents" ||
    normalized.startsWith("/agents/")
  );
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isOpen, mode } = useDocBrowser();
  useDocLinkInterceptor();
  const { pathname } = useLocation();
  const { language } = useI18n();
  const isMainRoute = isMainWorkspaceRoute(pathname);

  useEffect(() => {
    document.title = resolveUiDocumentTitle(pathname);
  }, [pathname, language]);

  return (
    <div className="h-screen flex bg-background font-sans text-foreground">
      {!isMainRoute && <Sidebar mode="settings" />}
      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {isMainRoute ? (
            <div className="flex-1 h-full overflow-hidden">{children}</div>
          ) : (
            <main className="flex-1 overflow-auto p-8 pb-16 custom-scrollbar">
              <div className="mx-auto h-full max-w-6xl animate-fade-in">
                {children}
              </div>
            </main>
          )}
        </div>
        {/* Doc Browser: docked mode renders inline, floating mode renders as overlay */}
        {isOpen && mode === "docked" && (
          <Suspense fallback={null}>
            <DocBrowser />
          </Suspense>
        )}
      </div>
      {isOpen && mode === "floating" && (
        <Suspense fallback={null}>
          <DocBrowser />
        </Suspense>
      )}
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <DocBrowserProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </DocBrowserProvider>
  );
}
