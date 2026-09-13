import {
  cloneElement,
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/utils";
import { ContextMenuItems, CONTEXT_MENU_SURFACE_CLASS } from "./context-menu-items";
export { ContextMenuItems } from "./context-menu-items";

type ContextMenuItemBase = {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  restoreFocus?: boolean;
};

export type ContextMenuItem = ContextMenuItemBase &
  (
    | {
        children?: never;
        download?: string;
        href: string;
        onSelect?: () => void;
      }
    | {
        children?: never;
        download?: never;
        href?: never;
        onSelect: () => void;
      }
    | {
        children: readonly ContextMenuGroup[];
        download?: never;
        href?: never;
        onSelect?: never;
      }
  );

export type ContextMenuGroup = {
  key: string;
  items: readonly ContextMenuItem[];
};

type ContextMenuPosition = {
  align: "start" | "end";
  x: number;
  y: number;
  trigger: HTMLElement;
};

type ContextMenuController = {
  isOpen: boolean;
  toggleFromButton: (trigger: HTMLElement) => void;
};

const ContextMenuControllerContext =
  createContext<ContextMenuController | null>(null);

const CONTEXT_MENU_EDGE_GAP = 8;

/** Radix dismisses overlays during capture, before the inner menu handles Escape. */
export function deferEscapeToNestedMenu(event: KeyboardEvent): boolean {
  if (!(event.target instanceof Element) || !event.target.closest('[data-menu-escape-owner]')) return false;
  event.preventDefault();
  return true;
}

function ContextMenuSurface({
  groups,
  label,
  onClose,
  position,
}: {
  groups: readonly ContextMenuGroup[];
  label: string;
  onClose: (restoreFocus: boolean) => void;
  position: ContextMenuPosition;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Keep modal menus inside the dialog's focus and pointer-event boundary.
  const portalHost =
    position.trigger.closest<HTMLElement>('[role="dialog"]') ?? document.body;
  const isModal = portalHost !== document.body;

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const reposition = () => {
      const bounds = isModal
        ? portalHost.getBoundingClientRect()
        : {
            left: 0,
            top: 0,
            right: window.innerWidth,
            bottom: window.innerHeight,
            height: window.innerHeight,
          };
      menu.style.maxHeight = `${Math.max(0, bounds.height - CONTEXT_MENU_EDGE_GAP * 2)}px`;
      const rect = menu.getBoundingClientRect();
      const preferredLeft =
        position.align === "end" ? position.x - rect.width : position.x;
      const left = Math.max(
        bounds.left + CONTEXT_MENU_EDGE_GAP,
        Math.min(
          preferredLeft,
          bounds.right - rect.width - CONTEXT_MENU_EDGE_GAP,
        ),
      );
      const top = Math.max(
        bounds.top + CONTEXT_MENU_EDGE_GAP,
        Math.min(
          position.y,
          bounds.bottom - rect.height - CONTEXT_MENU_EDGE_GAP,
        ),
      );
      menu.style.left = `${left - bounds.left}px`;
      menu.style.top = `${top - bounds.top}px`;
    };
    reposition();
    menu
      .querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
    const observer = new ResizeObserver(reposition);
    observer.observe(menu);
    return () => observer.disconnect();
  }, [position, portalHost, isModal]);

  return createPortal(
    <div
      className={cn(
        "pointer-events-auto inset-0 z-[var(--z-tooltip)]",
        isModal ? "absolute" : "fixed",
      )}
      data-context-menu-layer=""
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={() => onClose(true)}
    >
      <div
        ref={menuRef}
        role="menu"
        data-menu-escape-owner=""
        data-theme-overlay="menu"
        aria-label={label}
        className={cn(
          CONTEXT_MENU_SURFACE_CLASS,
          isModal ? "absolute" : "fixed",
        )}
        style={{ left: position.x, top: position.y }}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose(true);
          }
        }}
      >
        <ContextMenuItems groups={groups} onClose={onClose} />
      </div>
    </div>,
    portalHost,
  );
}

export function ContextMenu({
  children,
  groups,
  label,
}: {
  children: ReactElement<{
    "data-context-menu-open"?: string;
    onContextMenu?: (event: MouseEvent) => void;
  }>;
  groups: readonly ContextMenuGroup[];
  label: string;
}) {
  const [position, setPosition] = useState<ContextMenuPosition | null>(null);
  const visibleGroups = groups.filter((group) => group.items.length > 0);
  const closeMenu = (restoreFocus: boolean) => {
    const trigger = position?.trigger;
    setPosition(null);
    if (restoreFocus && trigger) {
      window.setTimeout(() => trigger.isConnected && trigger.focus(), 0);
    }
  };

  const toggleFromButton = (trigger: HTMLElement) => {
    if (position?.trigger === trigger) {
      closeMenu(true);
      return;
    }
    if (visibleGroups.length === 0) {
      return;
    }
    const bounds = trigger.getBoundingClientRect();
    setPosition({
      align: "end",
      x: bounds.right,
      y: bounds.bottom,
      trigger,
    });
  };

  const child = cloneElement(children, {
    "data-context-menu-open": position ? "" : undefined,
    onContextMenu: (event: MouseEvent) => {
      children.props.onContextMenu?.(event);
      if (event.defaultPrevented || visibleGroups.length === 0) {
        return;
      }
      event.preventDefault();
      const trigger = event.currentTarget as HTMLElement;
      const bounds = trigger.getBoundingClientRect();
      setPosition({
        align: "start",
        x: event.clientX || bounds.left,
        y: event.clientY || bounds.bottom,
        trigger,
      });
    },
  });

  return (
    <ContextMenuControllerContext.Provider
      value={{ isOpen: Boolean(position), toggleFromButton }}
    >
      {child}
      {position ? (
        <ContextMenuSurface
          groups={visibleGroups}
          label={label}
          position={position}
          onClose={closeMenu}
        />
      ) : null}
    </ContextMenuControllerContext.Provider>
  );
}

export function ContextMenuTrigger({
  children,
}: {
  children: ReactElement<{
    "aria-expanded"?: boolean;
    "aria-haspopup"?: "menu";
    onClick?: (event: MouseEvent) => void;
  }>;
}) {
  const controller = useContext(ContextMenuControllerContext);
  if (!controller) {
    throw new Error("ContextMenuTrigger must be rendered inside ContextMenu");
  }

  return cloneElement(children, {
    "aria-expanded": controller.isOpen,
    "aria-haspopup": "menu",
    onClick: (event: MouseEvent) => {
      children.props.onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      event.stopPropagation();
      controller.toggleFromButton(event.currentTarget as HTMLElement);
    },
  });
}
