import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ContextMenuGroup, ContextMenuItem } from "./context-menu";

export const CONTEXT_MENU_SURFACE_CLASS =
  "w-max min-w-52 max-w-[min(18rem,calc(100vw-16px))] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-[0_18px_48px_-20px_rgba(15,23,42,0.42)] outline-none";

function MenuItemContent({ item }: { item: ContextMenuItem }) {
  return <>
    {item.icon ? <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">{item.icon}</span> : null}
    <span className="min-w-0 flex-1 truncate">{item.label}</span>
    {item.children ? <ChevronRight className="h-4 w-4 shrink-0" /> : null}
  </>;
}

function ContextSubmenu({ item, open, onOpenChange, onClose, className, children }: {
  item: ContextMenuItem & { children: readonly ContextMenuGroup[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: (restoreFocus: boolean) => void;
  className: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement>();
  const setTrigger = useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    setPortalHost(node?.closest<HTMLElement>("[data-context-menu-layer]") ?? undefined);
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const keyboardOpen = useRef(false);
  const cancelPending = () => clearTimeout(timer.current);
  const schedule = (next: boolean) => {
    cancelPending();
    timer.current = setTimeout(() => onOpenChange(next), next ? 100 : 250);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const closeLevel = () => {
    cancelPending();
    onOpenChange(false);
    triggerRef.current?.focus();
  };
  const openFromControl = () => {
    cancelPending();
    keyboardOpen.current = true;
    onOpenChange(true);
    contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  };
  return <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger asChild>
      <button
        ref={setTrigger}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={item.disabled}
        data-menu-key={item.key}
        className={cn(className, open && "bg-muted")}
        onPointerEnter={(event) => {
          if (event.pointerType === "touch") return;
          keyboardOpen.current = false;
          schedule(true);
        }}
        onPointerLeave={() => schedule(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openFromControl();
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight") return;
          event.preventDefault();
          event.stopPropagation();
          openFromControl();
        }}
      >{children}</button>
    </Popover.Trigger>
    <Popover.Portal container={portalHost}>
      <Popover.Content
        ref={contentRef}
        role="menu"
        aria-label={item.label}
        data-menu-escape-owner=""
        data-theme-overlay="menu"
        side="right"
        align="start"
        sideOffset={2}
        collisionPadding={8}
        className={cn(CONTEXT_MENU_SURFACE_CLASS, "z-[var(--z-tooltip)]")}
        style={{
          minWidth: "min(13rem, var(--radix-popover-content-available-width))",
          maxWidth: "min(18rem, var(--radix-popover-content-available-width))",
          maxHeight: "var(--radix-popover-content-available-height)",
        }}
        onPointerEnter={cancelPending}
        onPointerLeave={() => schedule(false)}
        onPointerDown={(event) => event.stopPropagation()}
        onOpenAutoFocus={(event) => {
          if (!keyboardOpen.current) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => { event.preventDefault(); closeLevel(); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closeLevel();
          }
        }}
      >
        <ContextMenuItems groups={item.children} onClose={onClose} />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

/** The single item/group renderer for standalone and embedded action menus. */
export function ContextMenuItems({ groups, onClose }: {
  groups: readonly ContextMenuGroup[];
  onClose: (restoreFocus: boolean) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  return <div
    ref={containerRef}
    data-menu-level=""
    data-menu-escape-owner={openKey ? "" : undefined}
    onKeyDown={(event) => {
      // Portalled descendants retain React ancestry; each level owns its keys.
      if ((event.target as Element).closest('[data-menu-level]') !== containerRef.current) return;
      if (event.key === "Escape" && openKey) {
        event.preventDefault();
        event.stopPropagation();
        containerRef.current?.querySelector<HTMLElement>('[aria-expanded="true"]')?.focus();
        setOpenKey(null);
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        const items = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])
          .filter((item) => item.closest('[data-menu-level]') === containerRef.current);
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
          : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
        setOpenKey(null);
        items[next]?.focus();
      }
    }}
  >
    {groups.filter((group) => group.items.length).map((group, index) => <div key={group.key} role="group">
      {index > 0 ? <div className="my-1 h-px bg-border" /> : null}
      {group.items.map((item) => {
        const className = cn(
          "flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium outline-none transition-colors disabled:pointer-events-none disabled:opacity-45",
          item.destructive ? "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10" : "text-foreground hover:bg-muted focus-visible:bg-muted",
        );
        const content = <MenuItemContent item={item} />;
        if (item.children) return <ContextSubmenu key={item.key} item={item} open={openKey === item.key}
          onOpenChange={(open) => setOpenKey((current) => open ? item.key : current === item.key ? null : current)}
          onClose={onClose} className={className}>{content}</ContextSubmenu>;
        const select = () => { item.onSelect?.(); onClose(item.href ? false : item.restoreFocus !== false); };
        return item.href ? <a key={item.key} role="menuitem" className={className} href={item.href} download={item.download}
          onPointerEnter={() => setOpenKey(null)} onClick={(event) => { event.stopPropagation(); select(); }}>{content}</a>
          : <button key={item.key} type="button" role="menuitem" disabled={item.disabled} aria-pressed={item.pressed}
            data-menu-key={item.key} className={className} onPointerEnter={() => setOpenKey(null)}
            onClick={(event) => { event.stopPropagation(); select(); }}>{content}</button>;
      })}
    </div>)}
  </div>;
}
