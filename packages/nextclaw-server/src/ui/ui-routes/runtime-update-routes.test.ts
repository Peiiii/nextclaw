import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import type { UiRuntimeUpdateHost } from "./types.js";
import { createUiRouter } from "../router.js";
import { EventBus } from "@nextclaw/kernel";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-runtime-update-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

function createRuntimeUpdateHost(): UiRuntimeUpdateHost {
  return {
    getState: vi.fn(async () => ({
      status: "downloaded" as const,
      installationKind: "npm-runtime-bundle" as const,
      channel: "beta" as const,
      hostVersion: "0.18.12-beta.1",
      currentVersion: "0.18.12-beta.1",
      availableVersion: "0.18.12-beta.2",
      downloadedVersion: "0.18.12-beta.2",
      minimumHostVersion: null,
      releaseNotesUrl: null,
      lastCheckedAt: "2026-05-06T12:00:00.000Z",
      progress: null,
      canAutoDownload: true,
      canApplyInApp: true,
      requiresRestart: false,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null,
      preferences: {
        automaticChecks: true,
        autoDownload: true
      }
    })),
    checkForUpdates: vi.fn(async () => ({
      status: "checking" as const,
      installationKind: "npm-runtime-bundle" as const,
      channel: "beta" as const,
      hostVersion: "0.18.12-beta.1",
      currentVersion: "0.18.12-beta.1",
      availableVersion: null,
      downloadedVersion: null,
      minimumHostVersion: null,
      releaseNotesUrl: null,
      lastCheckedAt: null,
      progress: null,
      canAutoDownload: true,
      canApplyInApp: false,
      requiresRestart: false,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null,
      preferences: {
        automaticChecks: true,
        autoDownload: true
      }
    })),
    downloadUpdate: vi.fn(async () => ({
      status: "downloading" as const,
      installationKind: "npm-runtime-bundle" as const,
      channel: "beta" as const,
      hostVersion: "0.18.12-beta.1",
      currentVersion: "0.18.12-beta.1",
      availableVersion: "0.18.12-beta.2",
      downloadedVersion: null,
      minimumHostVersion: null,
      releaseNotesUrl: null,
      lastCheckedAt: null,
      progress: {
        downloadedBytes: 10,
        totalBytes: 100,
        percent: 10
      },
      canAutoDownload: true,
      canApplyInApp: false,
      requiresRestart: false,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null,
      preferences: {
        automaticChecks: true,
        autoDownload: true
      }
    })),
    applyDownloadedUpdate: vi.fn(async () => ({
      status: "restart-required" as const,
      installationKind: "npm-runtime-bundle" as const,
      channel: "beta" as const,
      hostVersion: "0.18.12-beta.1",
      currentVersion: "0.18.12-beta.2",
      availableVersion: null,
      downloadedVersion: null,
      minimumHostVersion: null,
      releaseNotesUrl: null,
      lastCheckedAt: null,
      progress: null,
      canAutoDownload: true,
      canApplyInApp: false,
      requiresRestart: true,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null,
      preferences: {
        automaticChecks: true,
        autoDownload: true
      }
    })),
    updatePreferences: vi.fn(async () => ({
      status: "idle" as const,
      installationKind: "npm-runtime-bundle" as const,
      channel: "beta" as const,
      hostVersion: "0.18.12-beta.1",
      currentVersion: "0.18.12-beta.1",
      availableVersion: null,
      downloadedVersion: null,
      minimumHostVersion: null,
      releaseNotesUrl: null,
      lastCheckedAt: null,
      progress: null,
      canAutoDownload: false,
      canApplyInApp: false,
      requiresRestart: false,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null,
      preferences: {
        automaticChecks: true,
        autoDownload: false
      }
    })),
    updateChannel: vi.fn(async () => ({
      status: "checking" as const,
      installationKind: "npm-runtime-bundle" as const,
      channel: "stable" as const,
      hostVersion: "0.18.12-beta.1",
      currentVersion: "0.18.12-beta.1",
      availableVersion: null,
      downloadedVersion: null,
      minimumHostVersion: null,
      releaseNotesUrl: null,
      lastCheckedAt: null,
      progress: null,
      canAutoDownload: true,
      canApplyInApp: false,
      requiresRestart: false,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null,
      preferences: {
        automaticChecks: true,
        autoDownload: true
      }
    }))
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  vi.restoreAllMocks();
});

describe("runtime update routes", () => {
  it("returns the runtime update snapshot", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const runtimeUpdate = createRuntimeUpdateHost();
    const app = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
      runtimeUpdate
    });

    const response = await app.request("http://localhost/api/runtime/update");
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        installationKind: string;
        downloadedVersion: string | null;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.installationKind).toBe("npm-runtime-bundle");
    expect(payload.data.downloadedVersion).toBe("0.18.12-beta.2");
    expect(runtimeUpdate.getState).toHaveBeenCalledOnce();
  });

  it("accepts download and apply requests", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const runtimeUpdate = createRuntimeUpdateHost();
    const app = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
      runtimeUpdate
    });

    const downloadResponse = await app.request("http://localhost/api/runtime/update/download", {
      method: "POST"
    });
    expect(downloadResponse.status).toBe(200);
    expect(runtimeUpdate.downloadUpdate).toHaveBeenCalledOnce();

    const applyResponse = await app.request("http://localhost/api/runtime/update/apply", {
      method: "POST"
    });
    expect(applyResponse.status).toBe(200);
    expect(runtimeUpdate.applyDownloadedUpdate).toHaveBeenCalledOnce();
  });
});
