import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { BrandHeader } from "@/shared/components/common/brand-header";
import { cn } from "@/shared/lib/utils";
import type { DesktopWindowStateSnapshot } from "@/platforms/desktop/types/desktop-update.types";

type DesktopWindowControlAction = "minimize" | "toggle-maximize" | "close";

type WindowControlDefinition = {
  action: DesktopWindowControlAction;
  label: string;
  icon: typeof Minus;
  variant?: "danger";
};

const windowControls: WindowControlDefinition[] = [
  { action: "minimize", label: "Minimize", icon: Minus },
  { action: "close", label: "Close", icon: X, variant: "danger" },
];

export function DesktopWindowChrome({
  sidebarCollapsed = false,
}: {
  sidebarCollapsed?: boolean;
}) {
  const isMaximized = useDesktopWindowMaximizedState();
  const maximizeControl: WindowControlDefinition = isMaximized
    ? { action: "toggle-maximize", label: "Restore", icon: Copy }
    : { action: "toggle-maximize", label: "Maximize", icon: Square };

  return (
    <header
      className="desktop-window-drag relative flex h-[var(--desktop-titlebar-height)] shrink-0 bg-secondary after:absolute after:bottom-0 after:left-[var(--desktop-sidebar-width)] after:right-0 after:border-b after:border-border/80"
      data-testid="desktop-window-chrome"
    >
      <div
        className="desktop-window-no-drag absolute left-0 right-0 top-0 h-1"
        data-testid="desktop-window-chrome-resize-strip"
      />
      <div
        className={cn(
          "desktop-window-drag relative z-10 flex h-full w-[var(--desktop-sidebar-width)] shrink-0 items-center bg-secondary text-secondary-foreground",
          sidebarCollapsed ? "justify-center px-0" : "pl-4 pr-3",
        )}
        data-testid="desktop-window-chrome-sidebar"
      >
        {sidebarCollapsed ? (
          <img
            src="/logo.svg"
            alt="NextClaw"
            className="h-6 w-6 shrink-0 object-contain"
          />
        ) : (
          <BrandHeader
            className="flex min-w-0 shrink-0 items-center gap-2.5"
            density="chrome"
          />
        )}
      </div>
      <div
        className="desktop-window-no-drag absolute right-0 top-0 z-20 flex h-full w-[var(--desktop-caption-safe-right)] items-start justify-end"
        data-testid="desktop-window-controls"
      >
        {[windowControls[0], maximizeControl, windowControls[1]].map(
          (control) => (
            <DesktopWindowControlButton
              key={control.action}
              control={control}
            />
          ),
        )}
      </div>
    </header>
  );
}

function DesktopWindowControlButton({
  control,
}: {
  control: WindowControlDefinition;
}) {
  const Icon = control.icon;

  return (
    <button
      type="button"
      aria-label={control.label}
      title={control.label}
      className={
        control.variant === "danger"
          ? "desktop-window-no-drag flex h-10 w-[46px] items-center justify-center text-gray-700 transition-colors hover:bg-red-500 hover:text-white"
          : "desktop-window-no-drag flex h-10 w-[46px] items-center justify-center text-gray-700 transition-colors hover:bg-black/10"
      }
      onClick={() => {
        void window.nextclawDesktop?.controlWindow?.(control.action);
      }}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function useDesktopWindowMaximizedState(): boolean {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    const desktopApi = window.nextclawDesktop;

    void desktopApi
      ?.getWindowState?.()
      .then((snapshot: DesktopWindowStateSnapshot) => {
        if (isSubscribed) {
          setIsMaximized(snapshot.isMaximized);
        }
      });
    const unsubscribe = desktopApi?.onWindowStateChanged?.(
      (snapshot: DesktopWindowStateSnapshot) => {
        setIsMaximized(snapshot.isMaximized);
      },
    );

    return () => {
      isSubscribed = false;
      unsubscribe?.();
    };
  }, []);

  return isMaximized;
}
