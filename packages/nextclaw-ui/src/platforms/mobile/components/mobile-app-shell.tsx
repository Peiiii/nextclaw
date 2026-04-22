import { lazy, Suspense } from "react";
import { isMainWorkspaceRoute } from "@/app/configs/app-navigation.config";
import { MobileBottomNav } from "@/platforms/mobile/components/mobile-bottom-nav";
import { MobileTopbar } from "@/platforms/mobile/components/mobile-topbar";

const DocBrowser = lazy(async () => ({
  default: (await import("@/shared/components/doc-browser/doc-browser")).DocBrowser,
}));

type MobileAppShellProps = {
  pathname: string;
  isDocBrowserOpen: boolean;
  children: React.ReactNode;
};

export function MobileAppShell({
  pathname,
  isDocBrowserOpen,
  children,
}: MobileAppShellProps) {
  const isMainRoute = isMainWorkspaceRoute(pathname);

  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
      <MobileTopbar />
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {isMainRoute ? (
          <div className="h-full min-h-0 overflow-hidden">{children}</div>
        ) : (
          <main className="h-full overflow-auto px-4 py-4 custom-scrollbar">
            <div className="mx-auto max-w-3xl animate-fade-in">{children}</div>
          </main>
        )}
      </div>
      <MobileBottomNav />
      {isDocBrowserOpen ? (
        <Suspense fallback={null}>
          <DocBrowser />
        </Suspense>
      ) : null}
    </div>
  );
}
