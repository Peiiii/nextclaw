import type {
  InstallationKind,
  UpdateBlockReason,
  UpdatePreferences,
  UpdateProgress,
  UpdateSnapshot,
  UpdateStatus,
} from '@nextclaw/shared';

export type DesktopUpdateStatus = Extract<
  UpdateStatus,
  'idle' | 'checking' | 'update-available' | 'downloading' | 'downloaded' | 'blocked' | 'up-to-date' | 'failed'
>;

export type DesktopReleaseChannel = 'stable' | 'beta';

export type DesktopInstallationKind = InstallationKind;

export type DesktopUpdateBlockReason = UpdateBlockReason;

export type DesktopUpdateProgress = UpdateProgress;

export type DesktopUpdatePreferences = UpdatePreferences;

export type DesktopUpdateSnapshot = UpdateSnapshot & {
  status: DesktopUpdateStatus;
  channel: DesktopReleaseChannel;
  launcherVersion: string;
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

export type DesktopUiLanguagePreference = 'en' | 'zh';

export type DesktopWindowControlAction = 'minimize' | 'toggle-maximize' | 'close';

export type NextClawDesktopBridge = {
  platform: string;
  version: string;
  localePreference?: DesktopUiLanguagePreference | null;
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
  setLocalePreference?: (language: DesktopUiLanguagePreference | null) => Promise<DesktopUiLanguagePreference | null>;
  controlWindow?: (action: DesktopWindowControlAction) => Promise<void>;
  onUpdateStateChanged: (listener: (snapshot: DesktopUpdateSnapshot) => void) => () => void;
};
