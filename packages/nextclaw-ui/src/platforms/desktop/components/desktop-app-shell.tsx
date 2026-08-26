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
import type { DocBrowserCustomTabRenderers } from "@/shared/components/doc-browser/doc-browser-renderer.types";
import type { DocBrowserDockControls } from "@/shared/components/doc-browser/doc-browser-context";
import type { DocBrowserTabMenuGroupsResolver } from "@/shared/components/doc-browser/doc-browser";
import { cn } from "@/shared/lib/utils";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";
import { SIDEBAR_RAIL_WIDTH_PX } from "@/app/components/layout/sidebar-rail.styles";
import { useScrollRestoration } from "@/shared/hooks/use-scroll-restoration";

const DocBrowser = lazy(async () => ({
  default: (await import("@/shared/components/doc-browser/doc-browser"))
    .DocBrowser,
}));

type DesktopAppShellProps = {
  pathname: string;
  isMobileLayout?: boolean;
  isDocBrowserOpen: boolean;
  docBrowserMode: "floating" | "docked";
  docBrowserDockControls?: DocBrowserDockControls;
  docBrowserRenderers?: DocBrowserCustomTabRenderers;
  docBrowserTabMenuGroups?: DocBrowserTabMenuGroupsResolver;
  sideDock?: React.ReactNode;
  children: React.ReactNode;
};

export function DesktopAppShell({
  pathname,
  isMobileLayout = false,
  isDocBrowserOpen,
  docBrowserMode,
  docBrowserDockControls,
  docBrowserRenderers = {},
  docBrowserTabMenuGroups,
  sideDock,
  children,
}: DesktopAppShellProps) {
  const isMainRoute = isMainWorkspaceRoute(pathname);
  const isSidebarCollapsed = useViewportLayoutStore(
    (state) => state.isSidebarCollapsed,
  );
  const showMobileBottomNav =
    isMobileLayout && !isChatSessionDetailRoute(pathname);
  const shouldUseWindowsChrome = isWindowsDesktopHost();
  const desktopSidebarWidth = isSidebarCollapsed
    ? `${SIDEBAR_RAIL_WIDTH_PX}px`
    : isMainRoute
      ? "280px"
      : "240px";
  const settingsScroll = useScrollRestoration<HTMLElement>({
    restorationKey: isMainRoute ? null : `settings-page:${pathname}`,
  });
  const { onScroll: onSettingsScroll, scrollRef: settingsScrollRef } = settingsScroll;

  return (
    <div
      className={cn(
        "h-screen flex flex-col overflow-hidden bg-background font-sans text-foreground",
        shouldUseWindowsChrome ? "rounded-[10px]" : null,
      )}
      style={
        shouldUseWindowsChrome
          ? ({
              "--desktop-titlebar-height": "40px",
              "--desktop-caption-safe-right": "140px",
              "--desktop-sidebar-width": desktopSidebarWidth,
            } as CSSProperties)
          : undefined
      }
    >
      {shouldUseWindowsChrome ? (
        <DesktopWindowChrome sidebarCollapsed={isSidebarCollapsed} />
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {!isMainRoute && <Sidebar />}
        <div className="flex-1 flex min-w-0 overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {isMainRoute ? (
              <div className="flex-1 h-full overflow-hidden">{children}</div>
            ) : (
              <main
                ref={settingsScrollRef}
                onScroll={onSettingsScroll}
                className="flex-1 overflow-auto p-8 pb-16 custom-scrollbar"
              >
                <div className="mx-auto h-full max-w-6xl animate-fade-in">
                  {children}
                </div>
              </main>
            )}
          </div>
          {isDocBrowserOpen && docBrowserMode === "docked" ? (
            <Suspense fallback={null}>
              <DocBrowser
                customTabRenderers={docBrowserRenderers}
                dockControls={docBrowserDockControls}
                getTabMenuGroups={docBrowserTabMenuGroups}
              />
            </Suspense>
          ) : null}
          {sideDock}
        </div>
      </div>
      {showMobileBottomNav ? <MobileBottomNav /> : null}
      {isDocBrowserOpen && docBrowserMode === "floating" ? (
        <Suspense fallback={null}>
          <DocBrowser
            customTabRenderers={docBrowserRenderers}
            dockControls={docBrowserDockControls}
            getTabMenuGroups={docBrowserTabMenuGroups}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
