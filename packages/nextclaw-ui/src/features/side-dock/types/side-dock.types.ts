export type SideDockItemId = string;

export type SideDockResourceItemTarget = {
  type: 'right-panel-resource';
  uri: string;
};

export type SideDockExternalUrlTarget = {
  type: 'external-url';
  url: string;
};

export type SideDockItemTarget = SideDockResourceItemTarget | SideDockExternalUrlTarget;

export type SideDockIconName = 'apps' | 'docs' | 'github' | 'new-tab' | 'panel-app' | 'service-apps';

export type SideDockItemIcon =
  | { type: 'builtin'; name: SideDockIconName }
  | { type: 'url'; url: string }
  | { type: 'text'; value: string };

export type SideDockItem = {
  builtIn: boolean;
  icon: SideDockItemIcon;
  id: SideDockItemId;
  label: string;
  removable: boolean;
  target: SideDockItemTarget;
};

export type SideDockPinnedItem = {
  createdAt: string;
  icon: SideDockItemIcon;
  id: SideDockItemId;
  label: string;
  target: SideDockResourceItemTarget;
};

export type SideDockResourceDockState = {
  canDock: boolean;
  isDocked: boolean;
  removable: boolean;
};
