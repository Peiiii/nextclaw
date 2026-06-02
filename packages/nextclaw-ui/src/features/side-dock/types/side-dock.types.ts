export type SideDockItemId = string;

export type SideDockItemTarget = {
  type: 'right-panel-resource';
  uri: string;
};

export type SideDockIconName = 'apps' | 'docs' | 'new-tab' | 'service-apps';

export type SideDockItemIcon =
  | { type: 'builtin'; name: SideDockIconName }
  | { type: 'url'; url: string };

export type SideDockItem = {
  builtIn: boolean;
  icon: SideDockItemIcon;
  id: SideDockItemId;
  labelKey: string;
  removable: boolean;
  target: SideDockItemTarget;
};

export type SideDockPinnedItem = {
  createdAt: string;
  icon: SideDockItemIcon;
  id: SideDockItemId;
  labelKey: string;
  target: SideDockItemTarget;
};
