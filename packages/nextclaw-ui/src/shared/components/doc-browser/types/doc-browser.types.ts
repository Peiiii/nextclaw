export type DocBrowserMode = 'floating' | 'docked';
export type DocBrowserTabKind = 'docs' | 'content' | (string & {});

export type DocBrowserTab = {
  id: string;
  kind: DocBrowserTabKind;
  title: string;
  currentUrl: string;
  resourceUri?: string;
  dockIcon?: DocBrowserDockIcon;
  dedupeKey?: string;
  history: string[];
  historyIndex: number;
  /** Increments on parent-initiated navigation to trigger iframe remount */
  navVersion: number;
};

export type DocBrowserRouteTarget = {
  dockIcon?: DocBrowserDockIcon;
  dedupeKey?: string;
  historyPolicy: 'managed' | 'none';
  kind: DocBrowserTabKind;
  resourceUri?: string;
  title: string;
  url: string;
};

export type DocBrowserDockIcon =
  | { type: 'builtin'; name: string }
  | { type: 'url'; url: string }
  | { type: 'text'; value: string };

export type DocBrowserDockState = {
  canDock: boolean;
  isDocked: boolean;
  removable: boolean;
};

export type DocBrowserDockControls = {
  getDockState: (tab?: DocBrowserTab) => DocBrowserDockState;
  pinTab: (tab?: DocBrowserTab) => void;
  unpinTab: (tab?: DocBrowserTab) => void;
};

export type DocBrowserRouteResolver = {
  areUrlsEquivalent: (
    currentUrl: string,
    nextUrl: string,
    currentKind: DocBrowserTabKind,
    nextKind: DocBrowserTabKind,
  ) => boolean;
  resolveOpenTarget: (params: {
    activeTab?: DocBrowserTab;
    kind?: DocBrowserTabKind;
    url?: string;
  }) => DocBrowserRouteTarget;
  usesManagedHistory: (tab: DocBrowserTab) => boolean;
};

export type DocBrowserActiveHistoryEntry = {
  kind: DocBrowserTabKind;
  resourceUri?: string;
  tabId: string;
  url: string;
};

export type DocBrowserOpenOptions = {
  activate?: boolean;
  dedupeKey?: string;
  dockIcon?: DocBrowserDockIcon;
  newTab?: boolean;
  title?: string;
  kind?: DocBrowserTabKind;
};

export type DocBrowserState = {
  isOpen: boolean;
  mode: DocBrowserMode;
  dockedWidth: number;
  tabs: DocBrowserTab[];
  activeTabId: string;
  activeHistory: DocBrowserActiveHistoryEntry[];
  activeHistoryIndex: number;
};

export type DocBrowserStateUpdate = DocBrowserState | ((prev: DocBrowserState) => DocBrowserState);

export type DocBrowserActions = {
  open: (url?: string, options?: DocBrowserOpenOptions) => void;
  openTarget: (target: DocBrowserRouteTarget, options?: DocBrowserOpenOptions) => void;
  openNewTab: () => void;
  close: () => void;
  toggleMode: () => void;
  setDockedWidth: (width: number) => void;
  navigate: (url: string) => void;
  syncUrl: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
};

export type DocBrowserContextValue = DocBrowserState & DocBrowserActions & {
  currentTab?: DocBrowserTab;
};
