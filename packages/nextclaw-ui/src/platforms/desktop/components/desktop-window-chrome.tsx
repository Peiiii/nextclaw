import { Maximize2, Minus, X } from "lucide-react";
import { BrandHeader } from "@/shared/components/common/brand-header";

type DesktopWindowControlAction = "minimize" | "toggle-maximize" | "close";

const windowControls: Array<{
  action: DesktopWindowControlAction;
  label: string;
  icon: typeof Minus;
  variant?: "danger";
}> = [
  { action: "minimize", label: "Minimize", icon: Minus },
  { action: "toggle-maximize", label: "Maximize", icon: Maximize2 },
  { action: "close", label: "Close", icon: X, variant: "danger" },
];

export function DesktopWindowChrome() {
  return (
    <header
      className="desktop-window-drag relative flex h-[var(--desktop-titlebar-height)] shrink-0 border-b border-[#ebe7dc]/80 bg-secondary"
      data-testid="desktop-window-chrome"
    >
      <div
        className="desktop-window-no-drag absolute left-0 right-0 top-0 h-1"
        data-testid="desktop-window-chrome-resize-strip"
      />
      <div
        className="desktop-window-no-drag relative z-10 flex h-full w-[var(--desktop-sidebar-width)] shrink-0 items-center bg-secondary pl-4 pr-3 text-secondary-foreground"
        data-testid="desktop-window-chrome-sidebar"
      >
        <div className="flex min-w-0 shrink-0 items-center">
          <BrandHeader
            className="flex min-w-0 items-center gap-2.5"
            density="chrome"
          />
        </div>
      </div>
      <div
        className="desktop-window-no-drag absolute right-0 top-0 z-20 flex h-full w-[var(--desktop-caption-safe-right)] items-start justify-end"
        data-testid="desktop-window-controls"
      >
        {windowControls.map((control) => (
          <DesktopWindowControlButton key={control.action} control={control} />
        ))}
      </div>
    </header>
  );
}

function DesktopWindowControlButton({
  control,
}: {
  control: (typeof windowControls)[number];
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
