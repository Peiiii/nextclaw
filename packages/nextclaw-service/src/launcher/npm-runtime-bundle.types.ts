import type { UpdateManifest, UpdateProgress, UpdateSnapshot } from "@nextclaw/kernel";

export type NpmRuntimeBundleManifest = {
  bundleVersion: string;
  platform: string;
  arch: string;
  uiVersion: string;
  runtimeVersion: string;
  builtInPluginSetVersion: string;
  launcherCompatibility: {
    minVersion: string;
  };
  entrypoints: {
    runtimeScript: string;
  };
  migrationVersion: number;
};

export type NpmRuntimeBundlePointer = {
  version: string;
};

export type NpmRuntimeUpdateState = {
  channel: "stable" | "beta";
  currentVersion: string | null;
  previousVersion: string | null;
  candidateVersion: string | null;
  candidateLaunchCount: number;
  lastKnownGoodVersion: string | null;
  badVersions: string[];
  lastUpdateCheckAt: string | null;
  downloadedVersion: string | null;
  downloadedReleaseNotesUrl: string | null;
  updatePreferences: {
    automaticChecks: boolean;
    autoDownload: boolean;
  };
};

export type NpmRuntimeDownloadedUpdate = {
  manifest: UpdateManifest;
  downloadedVersion: string;
  bundleDirectory: string;
};

export type NpmRuntimeUpdateProgressReporter = (progress: UpdateProgress) => void;

export type NpmRuntimeUpdateCommandResult = {
  snapshot: UpdateSnapshot;
  message: string;
};
