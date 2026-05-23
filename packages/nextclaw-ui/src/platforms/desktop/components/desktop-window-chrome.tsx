import { BrandHeader } from "@/shared/components/common/brand-header";

export function DesktopWindowChrome() {
  return (
    <header
      className="relative flex h-[var(--desktop-titlebar-height)] shrink-0 border-b border-[#ebe7dc]/80 bg-secondary"
      data-testid="desktop-window-chrome"
    >
      <div
        className="desktop-window-drag absolute bottom-0 left-0 right-[var(--desktop-caption-safe-right)] top-1"
        data-testid="desktop-window-chrome-drag-region"
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
    </header>
  );
}
