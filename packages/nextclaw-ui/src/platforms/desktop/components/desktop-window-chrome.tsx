import { BrandHeader } from "@/shared/components/common/brand-header";

export function DesktopWindowChrome() {
  return (
    <header
      className="flex h-[var(--desktop-titlebar-height)] shrink-0 bg-secondary"
      data-testid="desktop-window-chrome"
    >
      <div
        className="desktop-window-drag flex h-full w-[var(--desktop-sidebar-width)] shrink-0 items-center bg-secondary pl-4 pr-3 text-secondary-foreground"
        data-testid="desktop-window-chrome-sidebar"
      >
        <div className="desktop-window-no-drag flex min-w-0 shrink-0 items-center">
          <BrandHeader
            className="flex min-w-0 items-center gap-2.5"
            density="chrome"
          />
        </div>
        <div className="min-w-0 flex-1 self-stretch" aria-hidden="true" />
      </div>
      <div
        className="desktop-window-drag mr-[var(--desktop-caption-safe-right)] flex min-w-0 flex-1 items-center border-b border-[#ebe7dc]/80 bg-secondary"
        aria-hidden="true"
        data-testid="desktop-window-chrome-main"
      >
        <div className="min-w-0 flex-1 self-stretch" />
      </div>
    </header>
  );
}
