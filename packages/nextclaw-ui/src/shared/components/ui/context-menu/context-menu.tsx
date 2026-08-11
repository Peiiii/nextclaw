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
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/utils';

type ContextMenuItemBase = {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  restoreFocus?: boolean;
};

export type ContextMenuItem = ContextMenuItemBase &
  (
    | {
        download?: string;
        href: string;
        onSelect?: () => void;
      }
    | {
        download?: never;
        href?: never;
        onSelect: () => void;
      }
  );

export type ContextMenuGroup = {
  key: string;
  items: readonly ContextMenuItem[];
};

type ContextMenuPosition = {
  align: 'start' | 'end';
  x: number;
  y: number;
  trigger: HTMLElement;
};

type ContextMenuController = {
  isOpen: boolean;
  toggleFromButton: (trigger: HTMLElement) => void;
};

const ContextMenuControllerContext = createContext<ContextMenuController | null>(null);

const CONTEXT_MENU_EDGE_GAP = 8;

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

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const rect = menu.getBoundingClientRect();
    const preferredLeft = position.align === 'end' ? position.x - rect.width : position.x;
    const left = Math.max(
      CONTEXT_MENU_EDGE_GAP,
      Math.min(preferredLeft, window.innerWidth - rect.width - CONTEXT_MENU_EDGE_GAP),
    );
    const top = Math.max(
      CONTEXT_MENU_EDGE_GAP,
      Math.min(position.y, window.innerHeight - rect.height - CONTEXT_MENU_EDGE_GAP),
    );
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [position]);

  const moveFocus = (direction: 1 | -1) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (items.length === 0) {
      return;
    }
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-tooltip)]"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={() => onClose(true)}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        className="fixed min-w-52 max-w-72 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-[0_18px_48px_-20px_rgba(15,23,42,0.42)]"
        style={{ left: position.x, top: position.y }}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose(true);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveFocus(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveFocus(-1);
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)');
            items?.[event.key === 'Home' ? 0 : items.length - 1]?.focus();
          }
        }}
      >
        {groups.map((group, groupIndex) => (
          <div key={group.key} role="group">
            {groupIndex > 0 ? <div className="my-1 h-px bg-border" /> : null}
            {group.items.map((item) => {
              const itemClassName = cn(
                'flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium outline-none transition-colors',
                item.destructive
                  ? 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10'
                  : 'text-foreground hover:bg-muted focus-visible:bg-muted',
                'disabled:pointer-events-none disabled:opacity-45',
              );
              const content = (
                <>
                  {item.icon ? (
                    <span
                      className={cn(
                        'inline-flex h-4 w-4 shrink-0 items-center justify-center',
                        item.destructive ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </>
              );
              return item.href ? (
                <a
                  key={item.key}
                  role="menuitem"
                  className={itemClassName}
                  href={item.href}
                  download={item.download}
                  onClick={() => {
                    item.onSelect?.();
                    onClose(false);
                  }}
                >
                  {content}
                </a>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={itemClassName}
                  onClick={() => {
                    item.onSelect?.();
                    onClose(item.restoreFocus !== false);
                  }}
                >
                  {content}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

export function ContextMenu({
  children,
  groups,
  label,
}: {
  children: ReactElement<{
    'data-context-menu-open'?: string;
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
      align: 'end',
      x: bounds.right,
      y: bounds.bottom,
      trigger,
    });
  };

  const child = cloneElement(children, {
    'data-context-menu-open': position ? '' : undefined,
    onContextMenu: (event: MouseEvent) => {
      children.props.onContextMenu?.(event);
      if (event.defaultPrevented || visibleGroups.length === 0) {
        return;
      }
      event.preventDefault();
      const trigger = event.currentTarget as HTMLElement;
      const bounds = trigger.getBoundingClientRect();
      setPosition({
        align: 'start',
        x: event.clientX || bounds.left,
        y: event.clientY || bounds.bottom,
        trigger,
      });
    },
  });

  return (
    <ContextMenuControllerContext.Provider value={{ isOpen: Boolean(position), toggleFromButton }}>
      {child}
      {position ? (
        <ContextMenuSurface groups={visibleGroups} label={label} position={position} onClose={closeMenu} />
      ) : null}
    </ContextMenuControllerContext.Provider>
  );
}

export function ContextMenuTrigger({
  children,
}: {
  children: ReactElement<{
    'aria-expanded'?: boolean;
    'aria-haspopup'?: 'menu';
    onClick?: (event: MouseEvent) => void;
  }>;
}) {
  const controller = useContext(ContextMenuControllerContext);
  if (!controller) {
    throw new Error('ContextMenuTrigger must be rendered inside ContextMenu');
  }

  return cloneElement(children, {
    'aria-expanded': controller.isOpen,
    'aria-haspopup': 'menu',
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
