export const SIDEBAR_RAIL_WIDTH_PX = 56;
export const SIDEBAR_RAIL_WIDTH_CLASS = "w-[56px]";
export const SIDEBAR_RAIL_PADDING_X_CLASS = "px-2";
export const SIDEBAR_RAIL_CONTROL_CLASS = "h-9 w-9 rounded-xl";
export const SIDEBAR_RAIL_ICON_CLASS = "h-4 w-4";
export const SIDEBAR_RAIL_STACK_CLASS = "space-y-1";
export const SIDEBAR_RAIL_ITEM_GAP_CLASS = "gap-1";

// Shared by expanded navigation, compound rows and the collapsed rail.
// Use theme neutral tokens directly so legacy gray utility overrides cannot
// turn sidebar feedback into a content selection or accent surface.
export const SIDEBAR_ITEM_SURFACE_CLASS =
  "rounded-xl text-muted-foreground transition-colors duration-base hover:bg-[var(--sidebar-interaction-hover)] hover:text-foreground focus-within:bg-[var(--sidebar-interaction-hover)] has-[[data-context-menu-open]]:bg-[var(--sidebar-interaction-hover)]";

export const SIDEBAR_ITEM_ACTIVE_SURFACE_CLASS =
  "bg-[var(--sidebar-interaction-selection)] text-foreground hover:bg-[var(--sidebar-interaction-selection)] focus-within:bg-[var(--sidebar-interaction-selection)] has-[[data-context-menu-open]]:bg-[var(--sidebar-interaction-selection)]";

export const SIDEBAR_RAIL_SURFACE_CLASS =
  `${SIDEBAR_ITEM_SURFACE_CLASS} active:bg-[var(--sidebar-interaction-selection)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border`;

export const SIDEBAR_RAIL_ACTIVE_SURFACE_CLASS = SIDEBAR_ITEM_ACTIVE_SURFACE_CLASS;

export const SIDEBAR_RAIL_PRIMARY_SURFACE_CLASS =
  "bg-primary/10 text-primary transition-colors duration-base hover:bg-primary/15 hover:text-primary-700 active:bg-primary/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border";
