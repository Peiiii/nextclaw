import { lazy, Suspense } from "react";
import { isMainWorkspaceRoute } from "@/app/configs/app-navigation.config";
import { Sidebar } from "@/app/components/layout/sidebar";

const DocBrowser = lazy(async () => ({
  default: (await import("@/shared/components/doc-browser/doc-browser")).DocBrowser,
}));

type DesktopAppShellProps = {
  pathname: string;
  isDocBrowserOpen: boolean;
  docBrowserMode: "floating" | "docked";
  children: React.ReactNode;
};

export function DesktopAppShell({
  pathname,
  isDocBrowserOpen,
  docBrowserMode,
  children,
}: DesktopAppShellProps) {
  const isMainRoute = isMainWorkspaceRoute(pathname);

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
        {isDocBrowserOpen && docBrowserMode === "docked" ? (
          <Suspense fallback={null}>
            <DocBrowser />
          </Suspense>
        ) : null}
      </div>
      {isDocBrowserOpen && docBrowserMode === "floating" ? (
        <Suspense fallback={null}>
          <DocBrowser />
        </Suspense>
      ) : null}
    </div>
  );
}
