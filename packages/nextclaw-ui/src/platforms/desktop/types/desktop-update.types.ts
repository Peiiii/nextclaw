export type DesktopUpdateStatus =
  | 'idle'
  | 'checking'
  | 'update-available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'failed';

export type DesktopReleaseChannel = 'stable' | 'beta';

export type DesktopUpdatePreferences = {
  automaticChecks: boolean;
  autoDownload: boolean;
};

export type DesktopUpdateSnapshot = {
  status: DesktopUpdateStatus;
  channel: DesktopReleaseChannel;
  launcherVersion: string;
  currentVersion: string | null;
  availableVersion: string | null;
  downloadedVersion: string | null;
  releaseNotesUrl: string | null;
  lastCheckedAt: string | null;
  errorMessage: string | null;
  preferences: DesktopUpdatePreferences;
};

export type DesktopRuntimeControlResult = {
  accepted: boolean;
  action: 'restart-service' | 'restart-app';
  lifecycle: 'restarting-service' | 'restarting-app';
  message: string;
};

export type DesktopPresencePreferences = {
  closeToBackground: boolean;
  launchAtLogin: boolean;
};

export type DesktopPresenceSnapshot = DesktopPresencePreferences & {
  supportsLaunchAtLogin: boolean;
  launchAtLoginReason: string | null;
};

export type NextClawDesktopBridge = {
  platform: string;
  version: string;
  getUpdateState: () => Promise<DesktopUpdateSnapshot>;
  checkForUpdates: () => Promise<DesktopUpdateSnapshot>;
  downloadUpdate: () => Promise<DesktopUpdateSnapshot>;
  applyDownloadedUpdate: () => Promise<DesktopUpdateSnapshot>;
  updatePreferences: (preferences: Partial<DesktopUpdatePreferences>) => Promise<DesktopUpdateSnapshot>;
  updateChannel: (channel: DesktopReleaseChannel) => Promise<DesktopUpdateSnapshot>;
  restartService: () => Promise<DesktopRuntimeControlResult>;
  restartApp: () => Promise<DesktopRuntimeControlResult>;
  getPresenceState: () => Promise<DesktopPresenceSnapshot>;
  updatePresencePreferences: (preferences: Partial<DesktopPresencePreferences>) => Promise<DesktopPresenceSnapshot>;
  onUpdateStateChanged: (listener: (snapshot: DesktopUpdateSnapshot) => void) => () => void;
};
