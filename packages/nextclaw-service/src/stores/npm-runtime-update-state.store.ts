import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { NpmRuntimeUpdateState } from "@nextclaw-service/types/npm-runtime-bundle.types.js";
import type { NpmRuntimeReleaseChannel } from "@nextclaw-service/services/runtime/npm-runtime-update-source.service.js";

function createDefaultState(channel: NpmRuntimeReleaseChannel): NpmRuntimeUpdateState {
  return {
    channel,
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
      autoDownload: true
    }
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeChannel(value: unknown, fallback: NpmRuntimeReleaseChannel): NpmRuntimeReleaseChannel {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "beta") {
    return "beta";
  }
  if (trimmed === "stable") {
    return "stable";
  }
  return fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean))];
}

function normalizeUpdatePreferences(value: unknown): NpmRuntimeUpdateState["updatePreferences"] {
  const defaultState = createDefaultState("stable");
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaultState.updatePreferences };
  }
  const record = value as Record<string, unknown>;
  return {
    autoDownload:
      typeof record.autoDownload === "boolean"
        ? record.autoDownload
        : defaultState.updatePreferences.autoDownload
  };
}

function normalizeState(input: unknown, defaultChannel: NpmRuntimeReleaseChannel): NpmRuntimeUpdateState {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("npm runtime update state must be an object");
  }
  const record = input as Record<string, unknown>;
  const candidateLaunchCount = Number(record.candidateLaunchCount);
  return {
    channel: normalizeChannel(record.channel, defaultChannel),
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

type NpmRuntimeUpdateStateStoreOptions = {
  defaultChannel?: NpmRuntimeReleaseChannel;
};

export class NpmRuntimeUpdateStateStore {
  private readonly defaultChannel: NpmRuntimeReleaseChannel;

  constructor(
    private readonly statePath: string,
    options: NpmRuntimeUpdateStateStoreOptions = {}
  ) {
    this.defaultChannel = options.defaultChannel ?? "stable";
  }

  read = (): NpmRuntimeUpdateState => {
    if (!existsSync(this.statePath)) {
      const defaultState = createDefaultState(this.defaultChannel);
      return { ...defaultState, updatePreferences: { ...defaultState.updatePreferences } };
    }
    return normalizeState(JSON.parse(readFileSync(this.statePath, "utf8")), this.defaultChannel);
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
