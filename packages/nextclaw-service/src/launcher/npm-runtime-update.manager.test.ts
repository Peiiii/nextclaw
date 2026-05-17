import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  serializeUnsignedUpdateManifest,
  type UpdateManifest,
  type UnsignedUpdateManifest
} from "@nextclaw/kernel";
import { NpmRuntimeBundleLayoutStore } from "./npm-runtime-bundle-layout.store.js";
import {
  NpmRuntimeBundleService,
  resolveEffectiveNpmRuntimeVersion,
  shouldPreferPackagedNpmRuntime
} from "./npm-runtime-bundle.service.js";
import { NpmRuntimeUpdateManager } from "./npm-runtime-update.manager.js";
import { inferDefaultNpmRuntimeReleaseChannel, NpmRuntimeUpdateSourceService } from "./npm-runtime-update-source.service.js";
import { NpmRuntimeUpdateService } from "./npm-runtime-update.service.js";
import { NpmRuntimeUpdateStateStore } from "./npm-runtime-update-state.store.js";

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
  for (const relativePath of [
    "manifest.json",
    join("runtime", "dist", "cli", "app", "index.js"),
    join("ui", "index.html"),
    join("plugins", ".keep")
  ]) {
    const bytes = await readFile(join(sourceBundleDir, relativePath));
    zip.file(join("bundle", relativePath).replaceAll("\\", "/"), bytes);
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
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
  archiveBytes?: Buffer;
  launcherVersion?: string;
}) {
  const layout = new NpmRuntimeBundleLayoutStore(join(params.rootDir, "runtime-bundles"));
  const stateStore = new NpmRuntimeUpdateStateStore(join(params.rootDir, "state.json"));
  const bundleService = new NpmRuntimeBundleService({
    layout,
    stateStore,
    launcherVersion: params.launcherVersion ?? "0.1.0"
  });
  const updateService = new NpmRuntimeUpdateService({
    layout,
    bundleService,
    launcherVersion: params.launcherVersion ?? "0.1.0",
    bundlePublicKey: publicKey,
    fetchImpl: async (url) => {
      if (String(url).includes("manifest")) {
        return Response.json(params.manifest);
      }
      return new Response(params.archiveBytes ?? Buffer.from(""), {
        status: 200,
        headers: {
          "content-length": String(params.archiveBytes?.byteLength ?? 0)
        }
      });
    }
  });
  const manager = new NpmRuntimeUpdateManager({
    layout,
    stateStore,
    bundleService,
    updateService,
    resolveManifestUrl: () => "https://example.com/manifest.json",
    launcherVersion: params.launcherVersion ?? "0.1.0",
    channel: "stable"
  });
  return {
    layout,
    stateStore,
    manager
  };
}

describe("NpmRuntimeUpdateManager", () => {
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
});

describe("Npm runtime update defaults", () => {
  it("prefers the packaged npm runtime when the installed launcher is newer than current bundle", () => {
    expect(
      resolveEffectiveNpmRuntimeVersion({
        launcherVersion: "0.18.12-beta.7",
        currentBundleVersion: "0.18.12-beta.4"
      })
    ).toBe("0.18.12-beta.7");
    expect(
      shouldPreferPackagedNpmRuntime({
        launcherVersion: "0.18.12-beta.7",
        currentBundleVersion: "0.18.12-beta.4"
      })
    ).toBe(true);
  });

  it("defaults beta launchers to the beta channel when no state file exists", async () =>
    await withTempDir(async (rootDir) => {
      const stateStore = new NpmRuntimeUpdateStateStore(join(rootDir, "state.json"), {
        defaultChannel: inferDefaultNpmRuntimeReleaseChannel("0.18.12-beta.3")
      });

      expect(stateStore.read().channel).toBe("beta");
    }));

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

  it("infers beta as the default channel for beta launcher versions", () => {
    const source = new NpmRuntimeUpdateSourceService({
      env: {}
    });

    expect(source.resolveChannel(undefined, "0.18.12-beta.3")).toBe("beta");
    expect(source.resolveChannel(undefined, "0.18.12")).toBe("stable");
  });

  it("reports the packaged runtime version as current when it is newer than the current bundle pointer", async () =>
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
        launcherVersion: "0.18.12-beta.7"
      });

      expect(manager.getSnapshot().currentVersion).toBe("0.18.12-beta.7");
      expect(stateStore.read().currentVersion).toBe("0.18.12-beta.7");
    }));
});
