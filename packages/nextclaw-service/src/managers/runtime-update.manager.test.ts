import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { accessSync, chmodSync, constants, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  serializeUnsignedUpdateManifest,
  type UpdateManifest,
  type UnsignedUpdateManifest
} from "@nextclaw/kernel";
import { NpmRuntimeBundleLayoutStore } from "@nextclaw-service/stores/npm-runtime-bundle-layout.store.js";
import {
  compareNpmRuntimeVersions,
  isNpmRuntimeBundleComplete,
  NpmRuntimeBundleService,
  shouldPreferPackagedNpmRuntime
} from "@nextclaw-service/services/runtime/npm-runtime-bundle.service.js";
import { RuntimeUpdateManager } from "@nextclaw-service/managers/runtime-update.manager.js";
import { inferDefaultNpmRuntimeReleaseChannel, NpmRuntimeUpdateSourceService } from "@nextclaw-service/services/runtime/npm-runtime-update-source.service.js";
import { NpmRuntimeUpdateService } from "@nextclaw-service/services/runtime/npm-runtime-update.service.js";
import { NpmRuntimeUpdateStateStore } from "@nextclaw-service/stores/npm-runtime-update-state.store.js";

const keyPair = generateKeyPairSync("ed25519");
const publicKey = keyPair.publicKey.export({ type: "spki", format: "pem" }).toString();

function withTempDir(run: (rootDir: string) => Promise<void> | void): Promise<void> {
  const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-npm-runtime-update-"));
  return Promise.resolve()
    .then(() => run(rootDir))
    .finally(() => {
      rmSync(rootDir, { recursive: true, force: true });
    });
}

function writeBundleFixture(rootDir: string, version: string): string {
  const bundleDir = join(rootDir, version);
  mkdirSync(join(bundleDir, "runtime", "dist", "cli", "app"), { recursive: true });
  writeFileSync(join(bundleDir, "runtime", "dist", "cli", "app", "index.js"), "console.log('runtime');\n");
  const runnerPath = join(
    bundleDir,
    "runtime",
    "resources",
    "native",
    `${process.platform}-${process.arch}`,
    process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner"
  );
  mkdirSync(dirname(runnerPath), { recursive: true });
  writeFileSync(runnerPath, "runner");
  if (process.platform !== "win32") chmodSync(runnerPath, 0o755);
  mkdirSync(join(bundleDir, "ui"), { recursive: true });
  writeFileSync(join(bundleDir, "ui", "index.html"), "<html></html>\n");
  mkdirSync(join(bundleDir, "plugins"), { recursive: true });
  writeFileSync(join(bundleDir, "plugins", ".keep"), "\n");
  writeFileSync(
    join(bundleDir, "manifest.json"),
    `${JSON.stringify(
      {
        bundleVersion: version,
        platform: process.platform,
        arch: process.arch,
        uiVersion: version,
        runtimeVersion: version,
        builtInPluginSetVersion: version,
        launcherCompatibility: {
          minVersion: "0.1.0"
        },
        entrypoints: {
          runtimeScript: "runtime/dist/cli/app/index.js"
        },
        migrationVersion: 1
      },
      null,
      2
    )}\n`
  );
  return bundleDir;
}

async function createBundleArchive(rootDir: string, version: string): Promise<Buffer> {
  const sourceBundleDir = writeBundleFixture(rootDir, version);
  const zip = new JSZip();
  const runnerRelativePath = join(
    "runtime",
    "resources",
    "native",
    `${process.platform}-${process.arch}`,
    process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner"
  );
  for (const relativePath of [
    "manifest.json",
    join("runtime", "dist", "cli", "app", "index.js"),
    runnerRelativePath,
    join("ui", "index.html"),
    join("plugins", ".keep")
  ]) {
    const bytes = await readFile(join(sourceBundleDir, relativePath));
    zip.file(join("bundle", relativePath).replaceAll("\\", "/"), bytes, {
      unixPermissions: relativePath === runnerRelativePath ? 0o755 : 0o644
    });
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", platform: "UNIX" }));
}

function createManifest(overrides: Partial<UnsignedUpdateManifest> & Pick<UnsignedUpdateManifest, "latestVersion">): UpdateManifest {
  const unsignedManifest: UnsignedUpdateManifest = {
    channel: overrides.channel ?? "stable",
    platform: overrides.platform ?? process.platform,
    arch: overrides.arch ?? process.arch,
    hostKind: "npm-runtime-bundle",
    latestVersion: overrides.latestVersion,
    minimumLauncherVersion: overrides.minimumLauncherVersion ?? "0.1.0",
    bundleUrl: overrides.bundleUrl ?? "https://example.com/runtime.zip",
    bundleSha256: overrides.bundleSha256 ?? createHash("sha256").update("placeholder").digest("hex"),
    bundleSignature: overrides.bundleSignature ?? "c2lnbmF0dXJl",
    releaseNotesUrl: overrides.releaseNotesUrl ?? null
  };
  return {
    ...unsignedManifest,
    manifestSignature: sign(null, Buffer.from(serializeUnsignedUpdateManifest(unsignedManifest)), keyPair.privateKey).toString("base64")
  };
}

function createManager(params: {
  rootDir: string;
  manifest: UpdateManifest;
  manifestsByChannel?: Partial<Record<"stable" | "beta", UpdateManifest>>;
  archiveBytes?: Buffer;
  launcherVersion?: string;
  runningVersion?: string;
  channel?: "stable" | "beta";
}) {
  const {
    rootDir,
    manifest,
    archiveBytes,
    launcherVersion = "0.1.0"
  } = params;
  const layout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
  const stateStore = new NpmRuntimeUpdateStateStore(join(rootDir, "state.json"));
  const bundleService = new NpmRuntimeBundleService({
    layout,
    stateStore,
    launcherVersion
  });
  const updateService = new NpmRuntimeUpdateService({
    layout,
    bundleService,
    launcherVersion,
    bundlePublicKey: publicKey,
    fetchImpl: async (url) => {
      if (String(url).includes("manifest")) {
        const requestedChannel = String(url).includes("/beta/") ? "beta" : "stable";
        return Response.json(params.manifestsByChannel?.[requestedChannel] ?? manifest);
      }
      return new Response(archiveBytes ?? Buffer.from(""), {
        status: 200,
        headers: {
          "content-length": String(archiveBytes?.byteLength ?? 0)
        }
      });
    }
  });
  const runningVersion = params.runningVersion ?? stateStore.read().currentVersion ?? launcherVersion;
  const source = new NpmRuntimeUpdateSourceService({
    env: { NEXTCLAW_UPDATE_MANIFEST_BASE_URL: "https://example.com/npm-runtime-updates" }
  });
  const manager = new RuntimeUpdateManager({
    layout,
    stateStore,
    bundleService,
    updateService,
    resolveManifestUrls: source.resolveManifestUrls,
    launcherVersion,
    runningVersion,
    channel: params.channel ?? "stable"
  });
  return {
    layout,
    stateStore,
    manager
  };
}

describe("RuntimeUpdateManager", () => {
  it("bootstraps a complete bundle matching a fresh launcher version", async () =>
    await withTempDir(async (rootDir) => {
      const archiveBytes = await createBundleArchive(join(rootDir, "archive"), "0.45.2");
      const manifest = createManifest({
        latestVersion: "0.45.2",
        bundleSha256: createHash("sha256").update(archiveBytes).digest("hex"),
        bundleSignature: sign(null, archiveBytes, keyPair.privateKey).toString("base64")
      });
      const { manager, layout } = createManager({
        rootDir,
        manifest,
        archiveBytes,
        launcherVersion: "0.45.2",
        runningVersion: "0.45.2"
      });

      const snapshot = await manager.run();

      expect(snapshot).toMatchObject({
        status: "restart-required",
        currentVersion: "0.45.2",
        targetVersion: "0.45.2"
      });
      expect(layout.readCurrentPointer()).toEqual({ version: "0.45.2" });
    }));

  it("replaces an incomplete same-version bundle with the signed complete bundle", async () =>
    await withTempDir(async (rootDir) => {
      const layout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
      const incompleteBundle = writeBundleFixture(layout.getVersionsDir(), "0.45.2");
      const runnerRelativePath = join(
        "runtime",
        "resources",
        "native",
        `${process.platform}-${process.arch}`,
        process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner"
      );
      rmSync(join(incompleteBundle, runnerRelativePath));
      layout.writeCurrentPointer({ version: "0.45.2" });
      const archiveBytes = await createBundleArchive(join(rootDir, "archive"), "0.45.2");
      const manifest = createManifest({
        latestVersion: "0.45.2",
        bundleSha256: createHash("sha256").update(archiveBytes).digest("hex"),
        bundleSignature: sign(null, archiveBytes, keyPair.privateKey).toString("base64")
      });
      const { manager, stateStore } = createManager({
        rootDir,
        manifest,
        archiveBytes,
        launcherVersion: "0.45.2",
        runningVersion: "0.45.2"
      });

      expect(stateStore.read().currentVersion).toBeNull();
      await expect(manager.run()).resolves.toMatchObject({
        status: "restart-required",
        targetVersion: "0.45.2"
      });
      expect(existsSync(join(layout.getVersionDir("0.45.2"), runnerRelativePath))).toBe(true);
    }));

  it("updates by downloading and applying the runtime bundle in one default run", async () =>
    await withTempDir(async (rootDir) => {
      const initialLayout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
      const initialStateStore = new NpmRuntimeUpdateStateStore(join(rootDir, "state.json"));
      initialLayout.ensureLauncherDirs();
      writeBundleFixture(initialLayout.getVersionsDir(), "0.18.0");
      initialLayout.writeCurrentPointer({ version: "0.18.0" });
      initialStateStore.write({
        ...initialStateStore.read(),
        currentVersion: "0.18.0",
        lastKnownGoodVersion: "0.18.0"
      });

      const archiveBytes = await createBundleArchive(join(rootDir, "source"), "0.18.1");
      const manifest = createManifest({
        latestVersion: "0.18.1",
        bundleSha256: createHash("sha256").update(archiveBytes).digest("hex"),
        bundleSignature: sign(null, archiveBytes, keyPair.privateKey).toString("base64")
      });
      const { layout, manager, stateStore } = createManager({ rootDir, manifest, archiveBytes });

      const applied = await manager.run();
      expect(applied.status).toBe("restart-required");
      expect(layout.readPreviousPointer()).toEqual({ version: "0.18.0" });
      expect(layout.readCurrentPointer()).toEqual({ version: "0.18.1" });
      expect(stateStore.read().downloadedVersion).toBeNull();
      expect(stateStore.read().candidateVersion).toBe("0.18.1");
      if (process.platform !== "win32") {
        expect(() => accessSync(join(
          layout.getVersionsDir(),
          "0.18.1",
          "runtime/resources/native",
          `${process.platform}-${process.arch}`,
          "nextclaw-wasmtime-runner",
        ), constants.X_OK)).not.toThrow();
      }
    }));

  it("keeps download-only runtime updates staged until apply is requested", async () =>
    await withTempDir(async (rootDir) => {
      const initialLayout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
      const initialStateStore = new NpmRuntimeUpdateStateStore(join(rootDir, "state.json"));
      initialLayout.ensureLauncherDirs();
      writeBundleFixture(initialLayout.getVersionsDir(), "0.18.0");
      initialLayout.writeCurrentPointer({ version: "0.18.0" });
      initialStateStore.write({
        ...initialStateStore.read(),
        currentVersion: "0.18.0",
        lastKnownGoodVersion: "0.18.0"
      });

      const archiveBytes = await createBundleArchive(join(rootDir, "source"), "0.18.1");
      const manifest = createManifest({
        latestVersion: "0.18.1",
        bundleSha256: createHash("sha256").update(archiveBytes).digest("hex"),
        bundleSignature: sign(null, archiveBytes, keyPair.privateKey).toString("base64")
      });
      const { layout, manager, stateStore } = createManager({ rootDir, manifest, archiveBytes });

      const downloaded = await manager.run({ applyAfterDownload: false });
      expect(downloaded.status).toBe("downloaded");
      expect(downloaded.downloadedVersion).toBe("0.18.1");
      expect(layout.readCurrentPointer()).toEqual({ version: "0.18.0" });
      expect(stateStore.read().downloadedVersion).toBe("0.18.1");

      const applied = await manager.run({ apply: true });
      expect(applied.status).toBe("restart-required");
      expect(layout.readPreviousPointer()).toEqual({ version: "0.18.0" });
      expect(layout.readCurrentPointer()).toEqual({ version: "0.18.1" });
      expect(stateStore.read().downloadedVersion).toBeNull();
      expect(stateStore.read().candidateVersion).toBe("0.18.1");
    }));

  it("keeps an activated but not running bundle in restart-required state", async () =>
    await withTempDir(async (rootDir) => {
      const initialLayout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
      const initialStateStore = new NpmRuntimeUpdateStateStore(join(rootDir, "state.json"));
      initialLayout.ensureLauncherDirs();
      writeBundleFixture(initialLayout.getVersionsDir(), "0.31.0");
      initialLayout.writeCurrentPointer({ version: "0.31.0" });
      initialStateStore.write({
        ...initialStateStore.read(),
        currentVersion: "0.31.0"
      });
      const manifest = createManifest({ latestVersion: "0.31.0" });
      const { manager } = createManager({
        rootDir,
        manifest,
        launcherVersion: "0.30.0",
        runningVersion: "0.30.0"
      });

      expect(manager.getSnapshot()).toMatchObject({
        status: "restart-required",
        hostVersion: "0.30.0",
        currentVersion: "0.30.0",
        requiresRestart: true
      });
      await expect(manager.checkForUpdate()).resolves.toMatchObject({
        status: "restart-required",
        currentVersion: "0.30.0",
        requiresRestart: true
      });
    }));

  it("blocks when the npm launcher is older than minimumLauncherVersion", async () =>
    await withTempDir(async (rootDir) => {
      const manifest = createManifest({
        latestVersion: "0.18.2",
        minimumLauncherVersion: "9.0.0"
      });
      const { manager } = createManager({ rootDir, manifest, launcherVersion: "0.1.0" });

      const snapshot = await manager.run({ checkOnly: true });
      expect(snapshot.status).toBe("blocked");
      expect(snapshot.blockReason).toBe("host-too-old");
      expect(snapshot.recoveryCommand).toBe("npm install -g nextclaw@latest");
    }));

  it("offers the stable runtime when a beta launcher checks the matching stable release", async () =>
    await withTempDir(async (rootDir) => {
      const manifest = createManifest({
        latestVersion: "0.21.5"
      });
      const { manager } = createManager({ rootDir, manifest, launcherVersion: "0.21.5-beta.0" });

      const snapshot = await manager.run({ checkOnly: true });

      expect(snapshot.status).toBe("update-available");
      expect(snapshot.currentVersion).toBe("0.21.5-beta.0");
      expect(snapshot.availableVersion).toBe("0.21.5");
    }));

  it("offers a newer stable runtime while the selected channel is beta", async () =>
    await withTempDir(async (rootDir) => {
      const betaManifest = createManifest({
        channel: "beta",
        latestVersion: "0.48.0-beta.2"
      });
      const stableManifest = createManifest({
        channel: "stable",
        latestVersion: "0.48.1"
      });
      const { manager } = createManager({
        rootDir,
        manifest: betaManifest,
        manifestsByChannel: { beta: betaManifest, stable: stableManifest },
        launcherVersion: "0.48.0-beta.2",
        runningVersion: "0.48.0-beta.2",
        channel: "beta"
      });

      const snapshot = await manager.run({ checkOnly: true });

      expect(snapshot.status).toBe("update-available");
      expect(snapshot.currentVersion).toBe("0.48.0-beta.2");
      expect(snapshot.availableVersion).toBe("0.48.1");
    }));

  it("keeps a newer beta runtime ahead of the stable candidate", async () =>
    await withTempDir(async (rootDir) => {
      const betaManifest = createManifest({ channel: "beta", latestVersion: "0.49.0-beta.1" });
      const stableManifest = createManifest({ channel: "stable", latestVersion: "0.48.1" });
      const { manager } = createManager({
        rootDir,
        manifest: betaManifest,
        manifestsByChannel: { beta: betaManifest, stable: stableManifest },
        launcherVersion: "0.48.0-beta.2",
        runningVersion: "0.48.0-beta.2",
        channel: "beta"
      });

      const snapshot = await manager.run({ checkOnly: true });

      expect(snapshot.status).toBe("update-available");
      expect(snapshot.availableVersion).toBe("0.49.0-beta.1");
    }));
});

describe("Npm runtime update defaults", () => {
  it("compares npm runtime versions with prerelease precedence", () => {
    expect(compareNpmRuntimeVersions("0.21.5", "0.21.5-beta.0")).toBeGreaterThan(0);
    expect(compareNpmRuntimeVersions("0.21.5-beta.1", "0.21.5-beta.0")).toBeGreaterThan(0);
    expect(compareNpmRuntimeVersions("0.21.5-beta.0", "0.21.5")).toBeLessThan(0);
    expect(compareNpmRuntimeVersions("0.21.6-beta.0", "0.21.5")).toBeGreaterThan(0);
    expect(compareNpmRuntimeVersions("0.21.5+build.2", "0.21.5+build.1")).toBe(0);
  });

  it("prefers the packaged npm runtime when the installed launcher is newer than current bundle", () => {
    expect(
      shouldPreferPackagedNpmRuntime({
        launcherVersion: "0.18.12-beta.7",
        currentBundleVersion: "0.18.12-beta.4",
        packagedRuntimeComplete: true
      })
    ).toBe(true);
    expect(
      shouldPreferPackagedNpmRuntime({
        launcherVersion: "0.18.12-beta.7",
        currentBundleVersion: "0.18.12-beta.4",
        packagedRuntimeComplete: false
      })
    ).toBe(false);
  });

  it("prefers a complete bundle when the packaged runtime has the same version", () => {
    expect(
      shouldPreferPackagedNpmRuntime({
        launcherVersion: "0.45.1",
        currentBundleVersion: "0.45.1",
        packagedRuntimeComplete: true
      })
    ).toBe(false);
  });

  it("does not treat a runtime bundle without its platform runner as complete", async () =>
    await withTempDir(async (rootDir) => {
      const layout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
      const bundleDirectory = writeBundleFixture(layout.getVersionsDir(), "0.45.2");
      rmSync(join(
        bundleDirectory,
        "runtime",
        "resources",
        "native",
        `${process.platform}-${process.arch}`,
        process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner"
      ));
      expect(isNpmRuntimeBundleComplete({ bundleDirectory })).toBe(false);
    }));

  it("defaults beta launchers to the beta channel when no state file exists", async () =>
    await withTempDir(async (rootDir) => {
      const stateStore = new NpmRuntimeUpdateStateStore(join(rootDir, "state.json"), {
        defaultChannel: inferDefaultNpmRuntimeReleaseChannel("0.18.12-beta.3")
      });

      expect(stateStore.read().channel).toBe("beta");
    }));

  it("resolves beta checks to beta and stable manifests while stable remains isolated", () => {
    const source = new NpmRuntimeUpdateSourceService({
      env: { NEXTCLAW_UPDATE_MANIFEST_BASE_URL: "https://example.test/updates" },
      platform: "linux",
      arch: "x64"
    });

    expect(source.resolveManifestUrls("beta")).toEqual([
      "https://example.test/updates/beta/manifest-beta-linux-x64.json",
      "https://example.test/updates/stable/manifest-stable-linux-x64.json"
    ]);
    expect(source.resolveManifestUrls("stable")).toEqual([
      "https://example.test/updates/stable/manifest-stable-linux-x64.json"
    ]);
    expect(source.resolveManifestUrls("beta", "https://mirror.test/custom.json")).toEqual([
      "https://mirror.test/custom.json"
    ]);
  });

  it("keeps an existing persisted channel instead of overwriting it with the launcher default", async () =>
    await withTempDir(async (rootDir) => {
      const stateStore = new NpmRuntimeUpdateStateStore(join(rootDir, "state.json"), {
        defaultChannel: "beta"
      });
      stateStore.write({
        ...stateStore.read(),
        channel: "stable"
      });

      expect(stateStore.read().channel).toBe("stable");
    }));

  it("ignores and removes retired update preferences", async () =>
    await withTempDir(async (rootDir) => {
      const statePath = join(rootDir, "state.json");
      writeFileSync(statePath, `${JSON.stringify({
        channel: "stable",
        updatePreferences: {
          automaticChecks: false,
          autoDownload: false
        }
      }, null, 2)}\n`, "utf8");
      const stateStore = new NpmRuntimeUpdateStateStore(statePath);

      const normalized = stateStore.read();
      expect("updatePreferences" in normalized).toBe(false);
      stateStore.write(normalized);
      const persisted = JSON.parse(await readFile(statePath, "utf8"));
      expect("updatePreferences" in persisted).toBe(false);
    }));

  it("infers beta as the default channel for beta launcher versions", () => {
    const source = new NpmRuntimeUpdateSourceService({
      env: {}
    });

    expect(source.resolveChannel(undefined, "0.18.12-beta.3")).toBe("beta");
    expect(source.resolveChannel(undefined, "0.18.12")).toBe("stable");
  });

  it("keeps the complete bundle pointer as the installed version when a newer launcher is incomplete", async () =>
    await withTempDir(async (rootDir) => {
      const layout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
      const stateStore = new NpmRuntimeUpdateStateStore(join(rootDir, "state.json"));
      layout.ensureLauncherDirs();
      writeBundleFixture(layout.getVersionsDir(), "0.18.12-beta.4");
      layout.writeCurrentPointer({ version: "0.18.12-beta.4" });
      stateStore.write({
        ...stateStore.read(),
        currentVersion: "0.18.12-beta.4"
      });

      const manifest = createManifest({
        latestVersion: "0.18.12-beta.8"
      });
      const { manager } = createManager({
        rootDir,
        manifest,
        launcherVersion: "0.18.12-beta.7",
        runningVersion: "0.18.12-beta.7"
      });

      expect(manager.getSnapshot().currentVersion).toBe("0.18.12-beta.7");
      expect(stateStore.read().currentVersion).toBe("0.18.12-beta.4");
    }));

  it("clears stale installed-version state when no complete bundle pointer exists", async () =>
    await withTempDir(async (rootDir) => {
      const layout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
      const stateStore = new NpmRuntimeUpdateStateStore(join(rootDir, "state.json"));
      stateStore.write({
        ...stateStore.read(),
        currentVersion: "0.45.1"
      });

      createManager({
        rootDir,
        manifest: createManifest({ latestVersion: "0.45.1" }),
        launcherVersion: "0.45.1"
      });

      expect(layout.readCurrentPointer()).toBeNull();
      expect(stateStore.read().currentVersion).toBeNull();
    }));

  it("does not bootstrap an older runtime channel before the matching bundle is published", async () =>
    await withTempDir(async (rootDir) => {
      const { manager, layout } = createManager({
        rootDir,
        manifest: createManifest({ latestVersion: "0.45.1" }),
        launcherVersion: "0.45.2",
        runningVersion: "0.45.2"
      });

      const snapshot = await manager.run();

      expect(snapshot.status).toBe("up-to-date");
      expect(layout.readCurrentPointer()).toBeNull();
    }));
});
