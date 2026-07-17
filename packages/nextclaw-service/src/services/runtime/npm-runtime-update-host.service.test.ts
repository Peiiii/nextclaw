import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextclawKernel } from "@nextclaw/kernel";
import { eventKeys } from "@nextclaw/shared";
import { NextclawDistributionService } from "@nextclaw-service/services/runtime/nextclaw-distribution.service.js";
import { NpmRuntimeUpdateHost } from "./npm-runtime-update-host.service.js";

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
  const getSnapshot = vi.fn(() => ({
    installationKind: "npm-runtime-bundle" as const,
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
  }));

  return {
    getPackageVersion: vi.fn(() => "0.18.12-beta.4"),
    requestManagedServiceRestart: vi.fn().mockResolvedValue(undefined),
    sourceOptions: [] as Array<{ packagedPublicKeyPath?: string } | undefined>,
    stateStore: {
      read: vi.fn(() => state),
      update: vi.fn((updater: (current: typeof state) => typeof state) => {
        Object.assign(state, updater(state));
        return state;
      })
    },
    manager: {
      getSnapshot,
      checkForUpdate: vi.fn(async () => ({
        ...getSnapshot(),
        availableVersion: "0.18.13",
        downloadedVersion: null,
        canApplyInApp: false,
        status: "update-available" as const
      })),
      downloadUpdate: vi.fn(async () => getSnapshot()),
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

vi.mock("@nextclaw-service/utils/cli.utils.js", () => ({
  getPackageVersion: mocks.getPackageVersion
}));

vi.mock("@nextclaw-service/services/ui/service-remote-access.service.js", () => ({
  requestManagedServiceRestart: (...args: unknown[]) => mocks.requestManagedServiceRestart(...args)
}));

vi.mock("@nextclaw-service/stores/npm-runtime-bundle-layout.store.js", () => ({
  NpmRuntimeBundleLayoutStore: class {
    getStatePath = () => "/tmp/nextclaw-runtime-update-state.json";
  }
}));

vi.mock("@nextclaw-service/stores/npm-runtime-update-state.store.js", () => ({
  NpmRuntimeUpdateStateStore: class {
    read = () => mocks.stateStore.read();
    update = (updater: Parameters<typeof mocks.stateStore.update>[0]) => mocks.stateStore.update(updater);
  }
}));

vi.mock("@nextclaw-service/services/runtime/npm-runtime-bundle.service.js", () => ({
  NpmRuntimeBundleService: class {}
}));

vi.mock("@nextclaw-service/services/runtime/npm-runtime-update.service.js", () => ({
  NpmRuntimeUpdateService: class {}
}));

vi.mock("@nextclaw-service/services/runtime/npm-runtime-update-source.service.js", () => ({
  NpmRuntimeUpdateSourceService: class {
    constructor(options?: { packagedPublicKeyPath?: string }) {
      mocks.sourceOptions.push(options);
    }

    resolveChannel = () => "stable";
    resolveBundlePublicKey = () => "mock-public-key";
    resolveManifestUrl = () => "https://example.invalid/manifest.json";
  }
}));

vi.mock("@nextclaw-service/managers/runtime-update.manager.js", () => ({
  RuntimeUpdateManager: class {
    getSnapshot = () => mocks.manager.getSnapshot();
    checkForUpdate = () => mocks.manager.checkForUpdate();
    downloadUpdate = () => mocks.manager.downloadUpdate();
    applyDownloadedUpdate = () => mocks.manager.applyDownloadedUpdate();
  }
}));

const TEST_DISTRIBUTION = {
  version: "0.18.12-beta.4",
  appEntrypoint: "/pkg/dist/cli/app/index.js",
  launcherEntrypoint: "/pkg/dist/cli/launcher/index.js",
  uiDistDir: "/pkg/ui-dist",
  runtimeUpdatePublicKeyPath: "/pkg/resources/update-bundle-public.pem"
};

describe("NpmRuntimeUpdateHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sourceOptions.length = 0;
    NextclawDistributionService.configure(TEST_DISTRIBUTION);
  });

  it("uses distribution metadata when creating the runtime update source", () => {
    const eventBus = new NextclawKernel().eventBus;
    new NpmRuntimeUpdateHost({
      eventBus,
      applyRestartMode: "manual-process-restart",
      requestRestart: vi.fn(),
      uiConfig: { port: 55667 }
    });

    expect(mocks.sourceOptions).toEqual([
      { packagedPublicKeyPath: "/pkg/resources/update-bundle-public.pem" }
    ]);
    expect(mocks.getPackageVersion).not.toHaveBeenCalled();
  });

  it("returns completed check and download snapshots without requiring realtime events", async () => {
    const host = new NpmRuntimeUpdateHost({
      eventBus: new NextclawKernel().eventBus,
      applyRestartMode: "manual-process-restart",
      requestRestart: vi.fn(),
      uiConfig: { port: 55667 }
    });

    await expect(host.checkForUpdates()).resolves.toMatchObject({
      status: "update-available",
      availableVersion: "0.18.13"
    });
    await expect(host.downloadUpdate()).resolves.toMatchObject({
      status: "downloaded",
      downloadedVersion: "0.18.12-beta.4"
    });
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

  it("distinguishes a post-restart update check failure and records diagnostics", async () => {
    const cause = new Error("getaddrinfo ENOTFOUND updates.nextclaw.io");
    mocks.manager.checkForUpdate.mockRejectedValueOnce(new TypeError("fetch failed", { cause }));
    const logger = { error: vi.fn() };
    const host = new NpmRuntimeUpdateHost({
      eventBus: new NextclawKernel().eventBus,
      logger,
      applyRestartMode: "manual-process-restart",
      requestRestart: vi.fn(),
      uiConfig: { port: 55667 }
    });

    await expect(host.checkForUpdates()).resolves.toMatchObject({
      status: "failed",
      failureStage: "check",
      diagnosticCommand: "nextclaw logs path",
      errorMessage: "fetch failed: getaddrinfo ENOTFOUND updates.nextclaw.io"
    });
    expect(logger.error).toHaveBeenCalledWith(
      "runtime update operation failed",
      {
        failureStage: "check",
        errorMessage: "fetch failed: getaddrinfo ENOTFOUND updates.nextclaw.io"
      },
      expect.any(TypeError)
    );
  });
});
