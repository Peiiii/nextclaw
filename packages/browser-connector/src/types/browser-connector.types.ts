export type BrowserConnectorStatus = {
  connected: boolean;
  browserInstanceId?: string;
  extensionVersion?: string;
  protocolVersion?: number;
  extensionCapabilities?: string[];
  missingExtensionCapabilities?: string[];
  activeLeaseCount: number;
  nativeHostName: string;
};

export type BrowserExtensionReloadResult = {
  action: "extension.reload";
  reloading: true;
  reloaded: true;
  requestedAt: string;
  extensionVersion?: string;
  before: BrowserConnectorStatus;
  after: BrowserConnectorStatus;
};

export type BrowserTabInfo = {
  tabRef: string;
  title: string;
  url: string;
  active: boolean;
  windowId?: number;
  lastAccessed?: number;
  status?: string;
  pendingUrl?: string;
};

export type BrowserTabLease = {
  leaseId: string;
  tab: BrowserTabInfo;
  expiresAt: string;
};

export type BrowserPageSnapshot = {
  tab: BrowserTabInfo;
  title: string;
  url: string;
  text: string;
  links: BrowserSnapshotNode[];
  buttons: BrowserSnapshotNode[];
  inputs: BrowserSnapshotNode[];
  interactive: BrowserSnapshotNode[];
  truncated: boolean;
  warning: "untrusted-browser-page-content";
};

export type BrowserSnapshotNode = {
  ref?: string;
  selector: string;
  text?: string;
  ariaLabel?: string;
  placeholder?: string;
  role?: string;
  kind?: string;
  tagName: string;
  inputType?: string;
  href?: string;
  boundingBox?: BrowserElementBoundingBox;
  visible?: boolean;
  disabled?: boolean;
  unique?: boolean;
};

export type BrowserElementBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserPageLocateResult = {
  tab: BrowserTabInfo;
  query: string;
  matches: BrowserSnapshotNode[];
  warning: "untrusted-browser-page-content";
};

export type BrowserScreenshot = {
  tab: BrowserTabInfo;
  dataUrl?: string;
  mimeType: "image/png";
  outputPath?: string;
};

export type BrowserActionResult = {
  tab: BrowserTabInfo;
  action: string;
  selector?: string;
  ref?: string;
  textMatched?: string;
};

export type BrowserConnectorConfig = {
  homeDir: string;
  nativeHostName: string;
  extensionId: string;
  extensionDir: string;
  ipcPath: string;
};
