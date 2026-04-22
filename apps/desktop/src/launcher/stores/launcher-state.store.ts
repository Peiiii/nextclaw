import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type DesktopLauncherState = {
  channel: DesktopReleaseChannel;
  currentVersion: string | null;
  previousVersion: string | null;
  candidateVersion: string | null;
  candidateLaunchCount: number;
  lastKnownGoodVersion: string | null;
  badVersions: string[];
  lastAttemptedPackagedSeedVersion: string | null;
  lastAttemptedPackagedSeedSha256: string | null;
  lastUpdateCheckAt: string | null;
  downloadedVersion: string | null;
  downloadedReleaseNotesUrl: string | null;
  updatePreferences: {
    automaticChecks: boolean;
    autoDownload: boolean;
  };
  presencePreferences: {
    closeToBackground: boolean;
    launchAtLogin: boolean;
  };
  languagePreference?: DesktopUiLanguagePreference | null;
};

const DEFAULT_LAUNCHER_STATE: DesktopLauncherState = {
  channel: "stable",
  currentVersion: null,
  previousVersion: null,
  candidateVersion: null,
  candidateLaunchCount: 0,
  lastKnownGoodVersion: null,
  badVersions: [],
  lastAttemptedPackagedSeedVersion: null,
  lastAttemptedPackagedSeedSha256: null,
  lastUpdateCheckAt: null,
  downloadedVersion: null,
  downloadedReleaseNotesUrl: null,
  updatePreferences: {
    automaticChecks: true,
    autoDownload: false
  },
  presencePreferences: {
    closeToBackground: true,
    launchAtLogin: false
  },
  languagePreference: null
};

export type DesktopReleaseChannel = "stable" | "beta";
export type DesktopUiLanguagePreference = "en" | "zh";

export function normalizeDesktopReleaseChannel(value: unknown): DesktopReleaseChannel {
  return typeof value === "string" && value.trim().toLowerCase() === "beta" ? "beta" : "stable";
}

export function normalizeDesktopUiLanguagePreference(value: unknown): DesktopUiLanguagePreference | null {
  return value === "en" || value === "zh" ? value : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeState(parsed: unknown): DesktopLauncherState {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("launcher state must be an object");
  }
  const record = parsed as Record<string, unknown>;
  const channel = normalizeDesktopReleaseChannel(record.channel);
  const badVersions = isStringArray(record.badVersions)
    ? [...new Set(record.badVersions.map((entry: string) => entry.trim()).filter(Boolean))]
    : [];
  const candidateLaunchCount = Number(record.candidateLaunchCount);
  return {
    channel,
    currentVersion: normalizeOptionalString(record.currentVersion),
    previousVersion: normalizeOptionalString(record.previousVersion),
    candidateVersion: normalizeOptionalString(record.candidateVersion),
    candidateLaunchCount: Number.isInteger(candidateLaunchCount) && candidateLaunchCount >= 0 ? candidateLaunchCount : 0,
    lastKnownGoodVersion: normalizeOptionalString(record.lastKnownGoodVersion),
    badVersions,
    lastAttemptedPackagedSeedVersion: normalizeOptionalString(record.lastAttemptedPackagedSeedVersion),
    lastAttemptedPackagedSeedSha256: normalizeOptionalString(record.lastAttemptedPackagedSeedSha256),
    lastUpdateCheckAt: normalizeOptionalString(record.lastUpdateCheckAt),
    downloadedVersion: normalizeOptionalString(record.downloadedVersion),
    downloadedReleaseNotesUrl: normalizeOptionalString(record.downloadedReleaseNotesUrl),
    updatePreferences: normalizeUpdatePreferences(record.updatePreferences),
    presencePreferences: normalizePresencePreferences(record.presencePreferences),
    languagePreference: normalizeDesktopUiLanguagePreference(record.languagePreference)
  };
}

function normalizeUpdatePreferences(value: unknown): DesktopLauncherState["updatePreferences"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_LAUNCHER_STATE.updatePreferences };
  }
  const record = value as Record<string, unknown>;
  return {
    automaticChecks:
      typeof record.automaticChecks === "boolean"
        ? record.automaticChecks
        : DEFAULT_LAUNCHER_STATE.updatePreferences.automaticChecks,
    autoDownload:
      typeof record.autoDownload === "boolean"
        ? record.autoDownload
        : DEFAULT_LAUNCHER_STATE.updatePreferences.autoDownload
  };
}

function normalizePresencePreferences(value: unknown): DesktopLauncherState["presencePreferences"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_LAUNCHER_STATE.presencePreferences };
  }
  const record = value as Record<string, unknown>;
  return {
    closeToBackground:
      typeof record.closeToBackground === "boolean"
        ? record.closeToBackground
        : DEFAULT_LAUNCHER_STATE.presencePreferences.closeToBackground,
    launchAtLogin:
      typeof record.launchAtLogin === "boolean"
        ? record.launchAtLogin
        : DEFAULT_LAUNCHER_STATE.presencePreferences.launchAtLogin
  };
}

export class DesktopLauncherStateStore {
  constructor(private readonly statePath: string) {}

  hasStateFile = (): boolean => {
    return existsSync(this.statePath);
  };

  read = (): DesktopLauncherState => {
    if (!this.hasStateFile()) {
      return { ...DEFAULT_LAUNCHER_STATE };
    }
    const raw = readFileSync(this.statePath, "utf8");
    return normalizeState(JSON.parse(raw));
  };

  write = async (state: DesktopLauncherState): Promise<void> => {
    await mkdir(dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  };

  update = async (updater: (state: DesktopLauncherState) => DesktopLauncherState): Promise<DesktopLauncherState> => {
    const nextState = updater(this.read());
    await this.write(nextState);
    return nextState;
  };
}
