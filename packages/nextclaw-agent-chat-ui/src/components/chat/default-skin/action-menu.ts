/** Shared by the standalone chat skin and host application action menus. */
export const ACTION_MENU_SURFACE_CLASS =
  'w-max min-w-52 max-w-[min(18rem,calc(100vw-16px))] overflow-y-auto rounded-xl border border-border/40 bg-popover p-1 text-popover-foreground shadow-floating outline-none';

export const ACTION_MENU_ITEM_CLASS = 'flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 py-1 text-left text-[13px] leading-5 font-medium outline-none transition-colors disabled:pointer-events-none disabled:opacity-45';

export const ACTION_FEEDBACK = {
  icon: 'hover:before:bg-[var(--interaction-hover)] active:before:bg-[var(--interaction-hover)] disabled:hover:before:bg-transparent disabled:active:before:bg-transparent',
  item: 'hover:bg-[var(--interaction-hover)] focus-visible:bg-[var(--interaction-hover)] active:bg-[var(--interaction-hover)] disabled:hover:bg-transparent disabled:active:bg-transparent',
  destructive: 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 disabled:hover:bg-transparent',
} as const;
