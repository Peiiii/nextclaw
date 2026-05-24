import { lazy, Suspense } from "react";
import type { CSSProperties } from "react";
import {
  isChatSessionDetailRoute,
  isMainWorkspaceRoute,
} from "@/app/configs/app-navigation.config";
import { Sidebar } from "@/app/components/layout/sidebar";
import { DesktopWindowChrome } from "@/platforms/desktop/components/desktop-window-chrome";
import { isWindowsDesktopHost } from "@/platforms/desktop/utils/desktop-host.utils";
import { MobileBottomNav } from "@/platforms/mobile";
import { cn } from "@/shared/lib/utils";

const DocBrowser = lazy(async () => ({
  default: (await import("@/shared/components/doc-browser/doc-browser")).DocBrowser,
}));

type DesktopAppShellProps = {
  pathname: string;
  isMobileLayout?: boolean;
  isDocBrowserOpen: boolean;
  docBrowserMode: "floating" | "docked";
  children: React.ReactNode;
};

export function DesktopAppShell({
  pathname,
  isMobileLayout = false,
  isDocBrowserOpen,
  docBrowserMode,
  children,
}: DesktopAppShellProps) {
  const isMainRoute = isMainWorkspaceRoute(pathname);
  const showMobileBottomNav = isMobileLayout && !isChatSessionDetailRoute(pathname);
  const shouldUseWindowsChrome = isWindowsDesktopHost();

  return (
    <div
      className={cn(
        "h-screen flex flex-col overflow-hidden bg-background font-sans text-foreground",
        shouldUseWindowsChrome ? "rounded-[10px]" : null,
      )}
      style={shouldUseWindowsChrome ? ({
        "--desktop-titlebar-height": "40px",
        "--desktop-caption-safe-right": "140px",
        "--desktop-sidebar-width": isMainRoute ? "280px" : "240px",
      } as CSSProperties) : undefined}
    >
      {shouldUseWindowsChrome ? <DesktopWindowChrome /> : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
          {isDocBrowserOpen && docBrowserMode === "docked" ? (
            <Suspense fallback={null}>
              <DocBrowser />
            </Suspense>
          ) : null}
        </div>
      </div>
      {showMobileBottomNav ? <MobileBottomNav /> : null}
      {isDocBrowserOpen && docBrowserMode === "floating" ? (
        <Suspense fallback={null}>
          <DocBrowser />
        </Suspense>
      ) : null}
    </div>
  );
}
