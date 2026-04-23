import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import type { DesktopLauncherState } from "../stores/launcher-state.store";
import {
  serializeDesktopUnsignedUpdateManifest,
  type DesktopUnsignedUpdateManifest
} from "../utils/update-manifest.utils";

type BundleFixtureOptions = {
  rootDir: string;
  version: string;
  platform?: string;
  arch?: string;
  includeUi?: boolean;
  includePlugins?: boolean;
};

const bundleSigningKeyPair = generateKeyPairSync("ed25519");

export const bundlePublicKey = bundleSigningKeyPair.publicKey
  .export({
    type: "spki",
    format: "pem"
  })
  .toString();

export async function withTempDir(prefix: string, run: (rootDir: string) => Promise<void> | void): Promise<void> {
  const rootDir = mkdtempSync(join(tmpdir(), prefix));
  try {
    await run(rootDir);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

export function createLauncherState(overrides: Partial<DesktopLauncherState> = {}): DesktopLauncherState {
  return {
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
    ...overrides
  };
}

export function writeBundleFixture(options: BundleFixtureOptions): string {
  const {
    rootDir,
    version,
    platform = process.platform,
    arch = process.arch,
    includeUi = true,
    includePlugins = true
  } = options;
  const bundleDir = join(rootDir, version);
  mkdirSync(join(bundleDir, "runtime", "dist", "cli"), { recursive: true });
  writeFileSync(join(bundleDir, "runtime", "dist", "cli", "index.js"), "console.log('runtime');\n");

  if (includeUi) {
    mkdirSync(join(bundleDir, "ui"), { recursive: true });
    writeFileSync(join(bundleDir, "ui", "index.html"), "<html></html>\n");
  }

  if (includePlugins) {
    mkdirSync(join(bundleDir, "plugins"), { recursive: true });
    writeFileSync(join(bundleDir, "plugins", ".keep"), "\n");
  }

  writeFileSync(
    join(bundleDir, "manifest.json"),
    `${JSON.stringify(
      {
        bundleVersion: version,
        platform,
        arch,
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

export async function createBundleArchive(options: BundleFixtureOptions): Promise<Buffer> {
  const sourceBundleDir = writeBundleFixture(options);
  const zip = new JSZip();
  const bundlePrefix = "bundle";
  const files = [
    "manifest.json",
    join("runtime", "dist", "cli", "index.js"),
    join("ui", "index.html"),
    join("plugins", ".keep")
  ];

  await Promise.all(
    files.map(async (relativePath) => {
      const bytes = await readFile(join(sourceBundleDir, relativePath));
      zip.file(join(bundlePrefix, relativePath).replaceAll("\\", "/"), bytes);
    })
  );

  return await zip.generateAsync({ type: "nodebuffer" });
}

export function signBundleArchive(bytes: Buffer): string {
  return sign(null, bytes, bundleSigningKeyPair.privateKey).toString("base64");
}

export function createSignedUpdateManifest(
  overrides: Partial<DesktopUnsignedUpdateManifest> & Pick<DesktopUnsignedUpdateManifest, "latestVersion">
) {
  const manifest: DesktopUnsignedUpdateManifest = {
    channel: overrides.channel ?? "stable",
    platform: overrides.platform ?? process.platform,
    arch: overrides.arch ?? process.arch,
    latestVersion: overrides.latestVersion,
    minimumLauncherVersion: overrides.minimumLauncherVersion ?? "0.1.0",
    bundleUrl: overrides.bundleUrl ?? "https://example.com/nextclaw.bundle",
    bundleSha256: overrides.bundleSha256 ?? createHash("sha256").update(Buffer.from("placeholder")).digest("hex"),
    bundleSignature: overrides.bundleSignature ?? "c2lnbmF0dXJl",
    releaseNotesUrl: overrides.releaseNotesUrl ?? null
  };

  return {
    ...manifest,
    manifestSignature: sign(
      null,
      Buffer.from(serializeDesktopUnsignedUpdateManifest(manifest)),
      bundleSigningKeyPair.privateKey
    ).toString("base64")
  };
}
