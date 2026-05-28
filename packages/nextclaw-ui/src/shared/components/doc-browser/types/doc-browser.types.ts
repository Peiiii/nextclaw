export type DocBrowserMode = 'floating' | 'docked';
export type DocBrowserTabKind = 'docs' | 'content' | (string & {});

export type DocBrowserTab = {
  id: string;
  kind: DocBrowserTabKind;
  title: string;
  currentUrl: string;
  dedupeKey?: string;
  history: string[];
  historyIndex: number;
  /** Increments on parent-initiated navigation to trigger iframe remount */
  navVersion: number;
};

export type DocBrowserOpenOptions = {
  activate?: boolean;
  dedupeKey?: string;
  newTab?: boolean;
  title?: string;
  kind?: DocBrowserTabKind;
};

export type DocBrowserState = {
  isOpen: boolean;
  mode: DocBrowserMode;
  tabs: DocBrowserTab[];
  activeTabId: string;
};

export type DocBrowserStateUpdate = DocBrowserState | ((prev: DocBrowserState) => DocBrowserState);

export type DocBrowserActions = {
  open: (url?: string, options?: DocBrowserOpenOptions) => void;
  openNewTab: () => void;
  close: () => void;
  toggleMode: () => void;
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
