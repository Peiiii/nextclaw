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
  const { onScroll: onSettingsScroll, scrollRef: settingsScrollRef } =
    settingsScroll;

  return (
    <div
      data-theme-surface="app-shell"
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
      <div aria-hidden="true" data-theme-decoration="island-paper" />
      <svg aria-hidden="true" className="absolute h-0 w-0" focusable="false">
        <defs>
          <filter
            id="island-wind-filter"
            x="-8%"
            y="-8%"
            width="116%"
            height="116%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="turbulence"
              baseFrequency="0.0025 0.011"
              numOctaves="2"
              seed="7"
              result="island-wind-noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="8.5s"
                values="0.0025 0.011;0.0038 0.015;0.0028 0.009;0.0025 0.011"
                keyTimes="0;0.38;0.72;1"
                calcMode="spline"
                keySplines="0.42 0 0.25 1;0.45 0 0.2 1;0.4 0 0.3 1"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="island-wind-noise"
              scale="5"
              xChannelSelector="R"
              yChannelSelector="G"
            >
              <animate
                attributeName="scale"
                dur="8.5s"
                values="5;17;9;14;5"
                keyTimes="0;0.34;0.58;0.78;1"
                calcMode="spline"
                keySplines="0.42 0 0.25 1;0.45 0 0.2 1;0.4 0 0.3 1;0.42 0 0.3 1"
                repeatCount="indefinite"
              />
            </feDisplacementMap>
          </filter>
        </defs>
      </svg>
      <div aria-hidden="true" data-theme-decoration="island-palm">
        <span data-island-palm-part="frond-wind" />
      </div>
      {shouldUseWindowsChrome ? (
        <DesktopWindowChrome sidebarCollapsed={isSidebarCollapsed} />
      ) : null}
      <div className="relative z-[1] flex min-h-0 flex-1 overflow-hidden">
        {!isMainRoute && <Sidebar />}
        <div className="flex-1 flex min-w-0 overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {isMainRoute ? (
              <div className="flex-1 h-full overflow-hidden">{children}</div>
            ) : (
              <main
                data-theme-surface="settings-workspace"
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
