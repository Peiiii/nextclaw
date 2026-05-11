import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextclawKernel } from "@nextclaw/kernel";
import { eventKeys } from "@nextclaw/shared";
import { NpmRuntimeUpdateHost } from "../npm-runtime-update-host.service.js";

const mocks = vi.hoisted(() => {
  const state = {
    channel: "stable" as const,
    currentVersion: null,
    downloadedVersion: "0.18.12-beta.4",
    downloadedReleaseNotesUrl: null,
    lastUpdateCheckAt: null,
    badVersions: [],
    updatePreferences: {
      automaticChecks: false,
      autoDownload: true
    }
  };

  return {
    getPackageVersion: vi.fn(() => "0.18.12-beta.4"),
    requestManagedServiceRestart: vi.fn().mockResolvedValue(undefined),
    stateStore: {
      read: vi.fn(() => state),
      update: vi.fn((updater: (current: typeof state) => typeof state) => {
        Object.assign(state, updater(state));
        return state;
      })
    },
    manager: {
      getSnapshot: vi.fn(() => ({
        installationKind: "npm-runtime-bundle",
        channel: "stable" as const,
        hostVersion: "0.18.12-beta.4",
        currentVersion: null,
        availableVersion: null,
        downloadedVersion: "0.18.12-beta.4",
        minimumHostVersion: null,
        releaseNotesUrl: null,
        lastCheckedAt: null,
        progress: null,
        canAutoDownload: true,
        canApplyInApp: true,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: null,
        preferences: {
          automaticChecks: false,
          autoDownload: true
        },
        status: "downloaded" as const
      })),
      applyDownloadedUpdate: vi.fn(() => ({
        installationKind: "npm-runtime-bundle",
        channel: "stable" as const,
        hostVersion: "0.18.12-beta.4",
        currentVersion: "0.18.12-beta.4",
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
          automaticChecks: false,
          autoDownload: true
        },
        status: "restart-required" as const
      }))
    }
  };
});

vi.mock("@nextclaw-service/shared/utils/cli.utils.js", () => ({
  getPackageVersion: mocks.getPackageVersion
}));

vi.mock("@nextclaw-service/shared/services/ui/service-remote-access.service.js", () => ({
  requestManagedServiceRestart: (...args: unknown[]) => mocks.requestManagedServiceRestart(...args)
}));

vi.mock("@nextclaw-service/launcher/npm-runtime-bundle-layout.store.js", () => ({
  NpmRuntimeBundleLayoutStore: class {
    getStatePath = () => "/tmp/nextclaw-runtime-update-state.json";
  }
}));

vi.mock("@nextclaw-service/launcher/npm-runtime-update-state.store.js", () => ({
  NpmRuntimeUpdateStateStore: class {
    read = () => mocks.stateStore.read();
    update = (updater: Parameters<typeof mocks.stateStore.update>[0]) => mocks.stateStore.update(updater);
  }
}));

vi.mock("@nextclaw-service/launcher/npm-runtime-bundle.service.js", () => ({
  NpmRuntimeBundleService: class {}
}));

vi.mock("@nextclaw-service/launcher/npm-runtime-update.service.js", () => ({
  NpmRuntimeUpdateService: class {}
}));

vi.mock("@nextclaw-service/launcher/npm-runtime-update-source.service.js", () => ({
  NpmRuntimeUpdateSourceService: class {
    resolveChannel = () => "stable";
    resolveBundlePublicKey = () => "mock-public-key";
    resolveManifestUrl = () => "https://example.invalid/manifest.json";
  }
}));

vi.mock("@nextclaw-service/launcher/npm-runtime-update.manager.js", () => ({
  NpmRuntimeUpdateManager: class {
    getSnapshot = () => mocks.manager.getSnapshot();
    applyDownloadedUpdate = () => mocks.manager.applyDownloadedUpdate();
  }
}));

describe("NpmRuntimeUpdateHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a foreground serve process alive after applying a downloaded runtime update", async () => {
    const requestRestart = vi.fn();
    const eventBus = new NextclawKernel().eventBus;
    const host = new NpmRuntimeUpdateHost({
      eventBus,
      applyRestartMode: "manual-process-restart",
      requestRestart,
      uiConfig: { port: 55667 }
    });

    await expect(host.applyDownloadedUpdate()).resolves.toMatchObject({
      status: "restart-required",
      currentVersion: "0.18.12-beta.4",
      recoveryCommand: "Restart this NextClaw process to launch the downloaded runtime."
    });
    expect(mocks.requestManagedServiceRestart).not.toHaveBeenCalled();
    expect(requestRestart).not.toHaveBeenCalled();
  });

  it("restarts the managed local service after applying a downloaded runtime update", async () => {
    const requestRestart = vi.fn();
    const eventBus = new NextclawKernel().eventBus;
    const host = new NpmRuntimeUpdateHost({
      eventBus,
      applyRestartMode: "managed-service-restart",
      requestRestart,
      uiConfig: { port: 55667 }
    });

    await expect(host.applyDownloadedUpdate()).resolves.toMatchObject({
      status: "restart-required",
      currentVersion: "0.18.12-beta.4",
      recoveryCommand: null
    });
    expect(mocks.requestManagedServiceRestart).toHaveBeenCalledWith(requestRestart, {
      reason: "runtime update apply",
      uiPort: 55667
    });
  });

  it("publishes runtime update snapshots through the app event bus", async () => {
    const statuses: string[] = [];
    const eventBus = new NextclawKernel().eventBus;
    const unsubscribe = eventBus.on(eventKeys.runtimeUpdateSnapshot, (snapshot) => {
      statuses.push(snapshot.status);
    });
    const host = new NpmRuntimeUpdateHost({
      eventBus,
      applyRestartMode: "manual-process-restart",
      requestRestart: vi.fn(),
      uiConfig: { port: 55667 }
    });

    try {
      await host.applyDownloadedUpdate();
    } finally {
      unsubscribe();
    }

    expect(statuses).toEqual(["applying", "restart-required"]);
  });
});
