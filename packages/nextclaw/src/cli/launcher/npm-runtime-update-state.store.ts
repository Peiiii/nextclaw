import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { NpmRuntimeUpdateState } from "./npm-runtime-bundle.types.js";

const DEFAULT_NPM_RUNTIME_UPDATE_STATE: NpmRuntimeUpdateState = {
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
    autoDownload: true
  }
};

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeChannel(value: unknown): "stable" | "beta" {
  return typeof value === "string" && value.trim().toLowerCase() === "beta" ? "beta" : "stable";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean))];
}

function normalizeUpdatePreferences(value: unknown): NpmRuntimeUpdateState["updatePreferences"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_NPM_RUNTIME_UPDATE_STATE.updatePreferences };
  }
  const record = value as Record<string, unknown>;
  return {
    automaticChecks:
      typeof record.automaticChecks === "boolean"
        ? record.automaticChecks
        : DEFAULT_NPM_RUNTIME_UPDATE_STATE.updatePreferences.automaticChecks,
    autoDownload:
      typeof record.autoDownload === "boolean"
        ? record.autoDownload
        : DEFAULT_NPM_RUNTIME_UPDATE_STATE.updatePreferences.autoDownload
  };
}

function normalizeState(input: unknown): NpmRuntimeUpdateState {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("npm runtime update state must be an object");
  }
  const record = input as Record<string, unknown>;
  const candidateLaunchCount = Number(record.candidateLaunchCount);
  return {
    channel: normalizeChannel(record.channel),
    currentVersion: normalizeOptionalString(record.currentVersion),
    previousVersion: normalizeOptionalString(record.previousVersion),
    candidateVersion: normalizeOptionalString(record.candidateVersion),
    candidateLaunchCount: Number.isInteger(candidateLaunchCount) && candidateLaunchCount >= 0 ? candidateLaunchCount : 0,
    lastKnownGoodVersion: normalizeOptionalString(record.lastKnownGoodVersion),
    badVersions: normalizeStringArray(record.badVersions),
    lastUpdateCheckAt: normalizeOptionalString(record.lastUpdateCheckAt),
    downloadedVersion: normalizeOptionalString(record.downloadedVersion),
    downloadedReleaseNotesUrl: normalizeOptionalString(record.downloadedReleaseNotesUrl),
    updatePreferences: normalizeUpdatePreferences(record.updatePreferences)
  };
}

export class NpmRuntimeUpdateStateStore {
  constructor(private readonly statePath: string) {}

  read = (): NpmRuntimeUpdateState => {
    if (!existsSync(this.statePath)) {
      return { ...DEFAULT_NPM_RUNTIME_UPDATE_STATE, updatePreferences: { ...DEFAULT_NPM_RUNTIME_UPDATE_STATE.updatePreferences } };
    }
    return normalizeState(JSON.parse(readFileSync(this.statePath, "utf8")));
  };

  write = (state: NpmRuntimeUpdateState): void => {
    mkdirSync(dirname(this.statePath), { recursive: true });
    writeFileSync(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  };

  update = (updater: (state: NpmRuntimeUpdateState) => NpmRuntimeUpdateState): NpmRuntimeUpdateState => {
    const nextState = updater(this.read());
    this.write(nextState);
    return nextState;
  };
}
