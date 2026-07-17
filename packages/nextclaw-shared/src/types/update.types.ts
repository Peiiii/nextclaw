export type UpdateStatus =
  | "idle"
  | "checking"
  | "update-available"
  | "downloading"
  | "downloaded"
  | "applying"
  | "restart-required"
  | "up-to-date"
  | "blocked"
  | "failed";

export type InstallationKind =
  | "desktop-bundle"
  | "npm-runtime-bundle"
  | "npm-global"
  | "unknown";

export type UpdateBlockReason =
  | "host-too-old"
  | "unsupported-installation"
  | "signature-verification-unavailable";

export type UpdateFailureStage = "check" | "download" | "apply";

export type UpdateProgress = {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
};

export type UpdateSnapshot = {
  status: UpdateStatus;
  installationKind: InstallationKind;
  channel: "stable" | "beta";
  hostVersion: string | null;
  currentVersion: string | null;
  availableVersion: string | null;
  downloadedVersion: string | null;
  minimumHostVersion: string | null;
  releaseNotesUrl: string | null;
  lastCheckedAt: string | null;
  progress: UpdateProgress | null;
  canApplyInApp: boolean;
  requiresRestart: boolean;
  blockReason: UpdateBlockReason | null;
  recoveryCommand: string | null;
  errorMessage: string | null;
  failureStage?: UpdateFailureStage | null;
  diagnosticCommand?: string | null;
};
