import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type DesktopLauncherState = {
  channel: string;
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

const DEFAULT_LAUNCHER_STATE: DesktopLauncherState = {
  channel: "stable",
  currentVersion: null,
  previousVersion: null,
  candidateVersion: null,
  candidateLaunchCount: 0,
  lastKnownGoodVersion: null,
  badVersions: [],
  lastUpdateCheckAt: null,
  downloadedVersion: null,
  downloadedReleaseNotesUrl: null,
  updatePreferences: {
    automaticChecks: true,
    autoDownload: false
  }
};

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
  const channel = typeof record.channel === "string" && record.channel.trim() ? record.channel.trim() : "stable";
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
    lastUpdateCheckAt: normalizeOptionalString(record.lastUpdateCheckAt),
    downloadedVersion: normalizeOptionalString(record.downloadedVersion),
    downloadedReleaseNotesUrl: normalizeOptionalString(record.downloadedReleaseNotesUrl),
    updatePreferences: normalizeUpdatePreferences(record.updatePreferences)
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

export class DesktopLauncherStateStore {
  constructor(private readonly statePath: string) {}

  read = (): DesktopLauncherState => {
    if (!existsSync(this.statePath)) {
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
