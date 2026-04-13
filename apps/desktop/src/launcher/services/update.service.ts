import { createHash, createPublicKey, verify, type KeyObject } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import JSZip from "jszip";
import { DesktopBundleLifecycleService } from "./bundle-lifecycle.service";
import { DesktopBundleService, type ResolvedDesktopBundle } from "./bundle.service";
import { normalizeDesktopReleaseChannel } from "../stores/launcher-state.store";
import {
  DesktopUpdateManifestReader,
  serializeDesktopUnsignedUpdateManifest,
  type DesktopUpdateManifest
} from "../utils/update-manifest.utils";
import { compareDesktopVersions } from "../utils/version.utils";
import type { DesktopBundleLayoutStore } from "../stores/bundle-layout.store";
import { DesktopLauncherStateStore } from "../stores/launcher-state.store";

type FetchLike = typeof fetch;

type DesktopUpdateServiceOptions = {
  layout: DesktopBundleLayoutStore;
  channel?: string;
  resolveChannel?: () => string;
  platform?: NodeJS.Platform;
  arch?: string;
  launcherVersion: string;
  bundlePublicKey?: string;
  manifestReader?: DesktopUpdateManifestReader;
  fetchImpl?: FetchLike;
  now?: () => number;
};

export type DesktopAvailableUpdate =
  | {
      kind: "bundle-update";
      manifest: DesktopUpdateManifest;
    }
  | {
      kind: "launcher-update-required";
      manifest: DesktopUpdateManifest;
    }
  | {
      kind: "quarantined-bad-version";
      manifest: DesktopUpdateManifest;
    };

export type DesktopLauncherUpdateRequired = Extract<DesktopAvailableUpdate, { kind: "launcher-update-required" }>;
export type DesktopQuarantinedBadVersion = Extract<DesktopAvailableUpdate, { kind: "quarantined-bad-version" }>;

export type DownloadedDesktopBundle = {
  manifest: DesktopUpdateManifest;
  archivePath: string;
  sha256: string;
};

export type StagedDesktopBundleUpdate = {
  kind: "bundle-update-staged";
  manifest: DesktopUpdateManifest;
  activatedVersion: string;
  previousVersion: string | null;
  bundleDirectory: string;
};

export type DownloadedDesktopBundleUpdate = {
  kind: "bundle-update-downloaded";
  manifest: DesktopUpdateManifest;
  downloadedVersion: string;
  bundleDirectory: string;
};

export class DesktopUpdateService {
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly launcherVersion: string;
  private readonly resolveChannel: () => string;
  private readonly manifestReader: DesktopUpdateManifestReader;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => number;
  private readonly stateStore: DesktopLauncherStateStore;
  private readonly bundleService: DesktopBundleService;
  private readonly lifecycleService: DesktopBundleLifecycleService;
  private readonly bundlePublicKey: KeyObject | null;

  constructor(private readonly options: DesktopUpdateServiceOptions) {
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.launcherVersion = options.launcherVersion;
    this.resolveChannel = options.resolveChannel ?? (() => options.channel ?? "stable");
    this.manifestReader = options.manifestReader ?? new DesktopUpdateManifestReader();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.bundlePublicKey = this.parseBundlePublicKey(options.bundlePublicKey);
    this.stateStore = new DesktopLauncherStateStore(options.layout.getLauncherStatePath());
    this.bundleService = new DesktopBundleService({
      layout: options.layout,
      stateStore: this.stateStore,
      platform: this.platform,
      arch: this.arch,
      launcherVersion: this.launcherVersion
    });
    this.lifecycleService = new DesktopBundleLifecycleService({
      layout: options.layout,
      stateStore: this.stateStore,
      bundleService: this.bundleService
    });
  }

  checkForUpdate = async (manifestUrl: string, currentVersion: string | null): Promise<DesktopAvailableUpdate | null> => {
    const manifest = await this.fetchManifest(manifestUrl);
    this.assertManifestTarget(manifest, this.getChannel());
    if (compareDesktopVersions(this.launcherVersion, manifest.minimumLauncherVersion) < 0) {
      return {
        kind: "launcher-update-required",
        manifest
      };
    }
    if (this.stateStore.read().badVersions.includes(manifest.latestVersion)) {
      return {
        kind: "quarantined-bad-version",
        manifest
      };
    }
    if (currentVersion && compareDesktopVersions(manifest.latestVersion, currentVersion) <= 0) {
      return null;
    }
      return {
        kind: "bundle-update",
        manifest
    };
  };

  downloadBundle = async (manifest: DesktopUpdateManifest): Promise<DownloadedDesktopBundle> => {
    const response = await this.fetchImpl(manifest.bundleUrl);
    if (!response.ok) {
      throw new Error(`bundle download failed with status ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== manifest.bundleSha256) {
      throw new Error(`bundle sha256 mismatch: expected ${manifest.bundleSha256} but got ${sha256}`);
    }
    this.assertBundleSignature(manifest, bytes);

    await this.options.layout.ensureLauncherDirs();
    const archivePath = join(this.options.layout.getStagingDir(), `${manifest.latestVersion}-${this.now()}.bundle`);
    await mkdir(this.options.layout.getStagingDir(), { recursive: true });
    await writeFile(archivePath, bytes);
    const writtenSha256 = createHash("sha256").update(await readFile(archivePath)).digest("hex");
    if (writtenSha256 !== manifest.bundleSha256) {
      throw new Error(`written bundle sha256 mismatch: expected ${manifest.bundleSha256} but got ${writtenSha256}`);
    }

    return {
      manifest,
      archivePath,
      sha256: writtenSha256
    };
  };

  stageUpdate = async (
    manifestUrl: string,
    currentVersion: string | null
  ): Promise<StagedDesktopBundleUpdate | DesktopLauncherUpdateRequired | DesktopQuarantinedBadVersion | null> => {
    const checkedAt = new Date(this.now()).toISOString();
    const availableUpdate = await this.checkForUpdate(manifestUrl, currentVersion);
    await this.stateStore.update((state) => ({
      ...state,
      lastUpdateCheckAt: checkedAt
    }));
    if (
      !availableUpdate ||
      availableUpdate.kind === "launcher-update-required" ||
      availableUpdate.kind === "quarantined-bad-version"
    ) {
      return availableUpdate;
    }

    const downloadedUpdate = await this.downloadAndInstallUpdate(availableUpdate.manifest);
    const activation = await this.lifecycleService.activateVersion(downloadedUpdate.downloadedVersion);
    return {
      kind: "bundle-update-staged",
      manifest: availableUpdate.manifest,
      activatedVersion: activation.activatedVersion,
      previousVersion: activation.previousVersion,
      bundleDirectory: downloadedUpdate.bundleDirectory
    };
  };

  downloadAndInstallUpdate = async (
    manifest: DesktopUpdateManifest
  ): Promise<DownloadedDesktopBundleUpdate> => {
    const downloadedBundle = await this.downloadBundle(manifest);
    try {
      const installedBundle = await this.installDownloadedBundle(downloadedBundle);
      return {
        kind: "bundle-update-downloaded",
        manifest,
        downloadedVersion: installedBundle.manifest.bundleVersion,
        bundleDirectory: installedBundle.bundleDirectory
      };
    } finally {
      await rm(downloadedBundle.archivePath, { force: true });
    }
  };

  stageLocalArchive = async (archivePath: string): Promise<StagedDesktopBundleUpdate> => {
    const channel = this.getChannel();
    const extractedDirectory = await this.extractArchive(archivePath, `seed-${this.now()}`);
    try {
      const installedBundle = await this.bundleService.installFromDirectory(extractedDirectory);
      const activation = await this.lifecycleService.activateVersion(installedBundle.manifest.bundleVersion);
      return {
        kind: "bundle-update-staged",
        manifest: {
          channel,
          platform: this.platform,
          arch: this.arch,
          latestVersion: installedBundle.manifest.bundleVersion,
          minimumLauncherVersion: installedBundle.manifest.launcherCompatibility.minVersion,
          bundleUrl: `file://${archivePath}`,
          bundleSha256: "",
          bundleSignature: "",
          releaseNotesUrl: null,
          manifestSignature: ""
        },
        activatedVersion: activation.activatedVersion,
        previousVersion: activation.previousVersion,
        bundleDirectory: installedBundle.bundleDirectory
      };
    } finally {
      await rm(dirname(extractedDirectory), { recursive: true, force: true });
    }
  };

  readLocalArchiveBundleVersion = async (archivePath: string): Promise<string> => {
    const archive = await JSZip.loadAsync(await readFile(archivePath));
    const manifestEntry =
      archive.file("bundle/manifest.json") ??
      Object.values(archive.files).find((entry) => entry.name.endsWith("/manifest.json"));
    if (!manifestEntry) {
      throw new Error(`bundle archive does not contain manifest.json: ${archivePath}`);
    }
    const parsed = JSON.parse(await manifestEntry.async("text")) as { bundleVersion?: unknown };
    const bundleVersion = typeof parsed.bundleVersion === "string" ? parsed.bundleVersion.trim() : "";
    if (!bundleVersion) {
      throw new Error(`bundle archive manifest is missing bundleVersion: ${archivePath}`);
    }
    return bundleVersion;
  };

  private fetchManifest = async (manifestUrl: string): Promise<DesktopUpdateManifest> => {
    const response = await this.fetchImpl(manifestUrl);
    if (!response.ok) {
      throw new Error(`update manifest request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    const manifest = this.manifestReader.parse(payload, manifestUrl);
    this.assertManifestSignature(manifest);
    return manifest;
  };

  private assertManifestTarget = (manifest: DesktopUpdateManifest, channel: string): void => {
    if (manifest.channel !== channel) {
      throw new Error(`update manifest channel mismatch: expected ${channel} but got ${manifest.channel}`);
    }
    if (manifest.platform !== this.platform) {
      throw new Error(`update manifest platform mismatch: expected ${this.platform} but got ${manifest.platform}`);
    }
    if (manifest.arch !== this.arch) {
      throw new Error(`update manifest arch mismatch: expected ${this.arch} but got ${manifest.arch}`);
    }
  };

  private getChannel = (): string => {
    return normalizeDesktopReleaseChannel(this.resolveChannel());
  };

  private installDownloadedBundle = async (downloadedBundle: DownloadedDesktopBundle): Promise<ResolvedDesktopBundle> => {
    const extractedDirectory = await this.extractArchive(
      downloadedBundle.archivePath,
      `${downloadedBundle.manifest.latestVersion}-extract-${this.now()}`
    );
    try {
      return await this.bundleService.installFromDirectory(extractedDirectory);
    } finally {
      await rm(dirname(extractedDirectory), { recursive: true, force: true });
    }
  };

  private extractArchive = async (archivePath: string, extractionLabel: string): Promise<string> => {
    const extractedRoot = join(this.options.layout.getStagingDir(), extractionLabel);
    await rm(extractedRoot, { recursive: true, force: true });
    await mkdir(extractedRoot, { recursive: true });

    const archive = await JSZip.loadAsync(await readFile(archivePath));
    for (const entry of Object.values(archive.files)) {
      const outputPath = this.resolveArchiveEntryPath(extractedRoot, entry.name);
      if (entry.dir) {
        await mkdir(outputPath, { recursive: true });
        continue;
      }
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, await entry.async("nodebuffer"));
    }

    return await this.resolveExtractedBundleRoot(extractedRoot);
  };

  private resolveArchiveEntryPath = (rootDirectory: string, entryName: string): string => {
    const outputPath = resolve(rootDirectory, entryName);
    const normalizedRoot = `${resolve(rootDirectory)}${sep}`;
    if (outputPath !== resolve(rootDirectory) && !outputPath.startsWith(normalizedRoot)) {
      throw new Error(`bundle archive entry escapes extraction root: ${entryName}`);
    }
    return outputPath;
  };

  private resolveExtractedBundleRoot = async (extractedRoot: string): Promise<string> => {
    const directBundle = this.findBundleRootCandidate(extractedRoot);
    if (directBundle) {
      return directBundle;
    }

    const entries = await readdir(extractedRoot, { withFileTypes: true });
    const childDirectoryCandidates = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => this.findBundleRootCandidate(join(extractedRoot, entry.name)))
      .filter((candidate): candidate is string => Boolean(candidate));

    if (childDirectoryCandidates.length === 1) {
      return childDirectoryCandidates[0];
    }
    if (childDirectoryCandidates.length > 1) {
      throw new Error(`bundle archive contains multiple bundle roots under ${extractedRoot}`);
    }
    throw new Error(`bundle archive does not contain a valid manifest root under ${extractedRoot}`);
  };

  private findBundleRootCandidate = (candidateDirectory: string): string | null => {
    const manifestPath = join(candidateDirectory, "manifest.json");
    return existsSync(manifestPath) ? candidateDirectory : null;
  };

  private parseBundlePublicKey = (publicKey: string | undefined): KeyObject | null => {
    const normalizedKey = publicKey?.trim();
    if (!normalizedKey) {
      return null;
    }

    const pemOrEscapedPem = normalizedKey.replaceAll("\\n", "\n");
    if (pemOrEscapedPem.includes("BEGIN PUBLIC KEY")) {
      return createPublicKey(pemOrEscapedPem);
    }

    return createPublicKey({
      key: Buffer.from(normalizedKey, "base64"),
      format: "der",
      type: "spki"
    });
  };

  private assertManifestSignature = (manifest: DesktopUpdateManifest): void => {
    if (!this.bundlePublicKey) {
      throw new Error("manifest signature verification requires bundlePublicKey");
    }

    const signature = Buffer.from(manifest.manifestSignature, "base64");
    const payload = Buffer.from(serializeDesktopUnsignedUpdateManifest(manifest));
    const valid = verify(null, payload, this.bundlePublicKey, signature);
    if (!valid) {
      throw new Error(`manifest signature verification failed for ${manifest.latestVersion}`);
    }
  };

  private assertBundleSignature = (manifest: DesktopUpdateManifest, bytes: Buffer): void => {
    if (!this.bundlePublicKey) {
      throw new Error("bundle signature verification requires bundlePublicKey");
    }

    const signature = Buffer.from(manifest.bundleSignature, "base64");
    const valid = verify(null, bytes, this.bundlePublicKey, signature);
    if (!valid) {
      throw new Error(`bundle signature verification failed for ${manifest.latestVersion}`);
    }
  };
}
