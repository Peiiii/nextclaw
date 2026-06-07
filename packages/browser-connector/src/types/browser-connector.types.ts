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

export type BrowserTabCloseResult = {
  closed: true;
  tabRef: string;
  ownedByConnector: boolean;
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
  frames?: BrowserSnapshotNode[];
  interactive: BrowserSnapshotNode[];
  truncated: boolean;
  warning: "untrusted-browser-page-content";
};

export type BrowserSnapshotNode = {
  ref?: string;
  elementId?: string;
  selector: string;
  selectorCandidates?: string[];
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
  enabled?: boolean;
  editable?: boolean;
  value?: string;
  valueLength?: number;
  checked?: boolean;
  selected?: boolean;
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

export type BrowserElementTarget = {
  selector?: string;
  ref?: string;
  frameSelector?: string;
};

export type BrowserElementInspection = BrowserSnapshotNode & {
  count: number;
  unique: boolean;
};

export type BrowserPageInspectResult = {
  tab: BrowserTabInfo;
  target: BrowserElementTarget;
  element: BrowserElementInspection;
  warning: "untrusted-browser-page-content";
};

export type BrowserScreenshot = {
  tab: BrowserTabInfo;
  dataUrl?: string;
  mimeType: "image/png";
  outputPath?: string;
  fullPage?: boolean;
  clip?: BrowserElementBoundingBox;
};

export type BrowserActionResult = {
  tab: BrowserTabInfo;
  action: string;
  selector?: string;
  ref?: string;
  element?: BrowserElementInspection;
  before?: BrowserElementInspection;
  after?: BrowserElementInspection;
  receiver?: BrowserElementInspection;
  changed?: boolean;
  inputMode?: string;
  pasteAccepted?: boolean;
  valueLength?: number;
  preview?: string;
  matchedExpectedText?: boolean;
  pageTextMatched?: boolean;
  textMatched?: string;
  urlMatched?: string;
  loadState?: string;
  scroll?: BrowserScrollState;
  logs?: BrowserPageLogEntry[];
  closed?: true;
  tabRef?: string;
  ownedByConnector?: boolean;
};

export type BrowserScrollState = {
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
};

export type BrowserPageLogEntry = {
  level: "debug" | "info" | "log" | "warn" | "error";
  message: string;
  timestamp: string;
  url?: string;
};

export type BrowserConnectorConfig = {
  homeDir: string;
  nativeHostName: string;
  extensionId: string;
  extensionDir: string;
  ipcPath: string;
};
