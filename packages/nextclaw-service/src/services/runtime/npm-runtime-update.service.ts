import { createHash, createPublicKey, verify, type KeyObject } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, sep } from "node:path";
import JSZip from "jszip";
import {
  serializeUnsignedUpdateManifest,
  UpdateManifestReader,
  type UpdateManifest
} from "@nextclaw/kernel";
import type { NpmRuntimeBundleLayoutStore } from "@nextclaw-service/stores/npm-runtime-bundle-layout.store.js";
import { compareNpmRuntimeVersions, type NpmRuntimeBundleService } from "@nextclaw-service/services/runtime/npm-runtime-bundle.service.js";
import type {
  NpmRuntimeDownloadedUpdate,
  NpmRuntimeUpdateProgressReporter
} from "@nextclaw-service/types/npm-runtime-bundle.types.js";

type FetchLike = typeof fetch;

type NpmRuntimeUpdateServiceOptions = {
  layout: NpmRuntimeBundleLayoutStore;
  bundleService: NpmRuntimeBundleService;
  launcherVersion: string;
  bundlePublicKey?: string;
  fetchImpl?: FetchLike;
  platform?: NodeJS.Platform;
  arch?: string;
  manifestReader?: UpdateManifestReader;
  now?: () => number;
};

export type NpmRuntimeAvailableUpdate =
  | { kind: "runtime-bundle-update"; manifest: UpdateManifest }
  | { kind: "host-update-required"; manifest: UpdateManifest }
  | { kind: "quarantined-bad-version"; manifest: UpdateManifest };

export class NpmRuntimeUpdateService {
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly fetchImpl: FetchLike;
  private readonly manifestReader: UpdateManifestReader;
  private readonly bundlePublicKey: KeyObject | null;
  private readonly now: () => number;

  constructor(private readonly options: NpmRuntimeUpdateServiceOptions) {
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.manifestReader = options.manifestReader ?? new UpdateManifestReader();
    this.bundlePublicKey = this.parseBundlePublicKey(options.bundlePublicKey);
    this.now = options.now ?? Date.now;
  }

  hasSignatureVerifier = (): boolean => Boolean(this.bundlePublicKey);

  checkForUpdate = async (manifestUrl: string, currentVersion: string | null, badVersions: string[] = []): Promise<NpmRuntimeAvailableUpdate | null> => {
    const manifest = await this.fetchManifest(manifestUrl);
    if (currentVersion && compareNpmRuntimeVersions(manifest.latestVersion, currentVersion) <= 0) {
      return null;
    }
    if (compareNpmRuntimeVersions(this.options.launcherVersion, manifest.minimumLauncherVersion) < 0) {
      return { kind: "host-update-required", manifest };
    }
    if (badVersions.includes(manifest.latestVersion)) {
      return { kind: "quarantined-bad-version", manifest };
    }
    return { kind: "runtime-bundle-update", manifest };
  };

  downloadAndInstallUpdate = async (
    manifest: UpdateManifest,
    reportProgress?: NpmRuntimeUpdateProgressReporter
  ): Promise<NpmRuntimeDownloadedUpdate> => {
    const bytes = await this.downloadBundleBytes(manifest, reportProgress);
    const stagingRoot = join(this.options.layout.getStagingDir(), `download-${manifest.latestVersion}-${this.now()}`);
    await rm(stagingRoot, { recursive: true, force: true });
    mkdirSync(stagingRoot, { recursive: true });

    try {
      const zip = await JSZip.loadAsync(bytes);
      const entries = Object.values(zip.files) as JSZip.JSZipObject[];
      await Promise.all(entries.map(async (entry) => {
        const targetPath = resolve(stagingRoot, entry.name);
        const resolvedStagingRoot = resolve(stagingRoot);
        if (targetPath !== resolvedStagingRoot && !targetPath.startsWith(`${resolvedStagingRoot}${sep}`)) {
          throw new Error(`runtime bundle archive contains invalid path: ${entry.name}`);
        }
        if (entry.dir) {
          mkdirSync(targetPath, { recursive: true });
          return;
        }
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, Buffer.from(await entry.async("uint8array")));
      }));
      const bundleRoot = this.findBundleRoot(stagingRoot);
      const installedBundle = await this.options.bundleService.installFromDirectory(bundleRoot);
      return {
        manifest,
        downloadedVersion: installedBundle.manifest.bundleVersion,
        bundleDirectory: installedBundle.bundleDirectory
      };
    } catch (error) {
      await rm(stagingRoot, { recursive: true, force: true });
      throw error;
    }
  };

  private downloadBundleBytes = async (
    manifest: UpdateManifest,
    reportProgress?: NpmRuntimeUpdateProgressReporter
  ): Promise<Buffer> => {
    const response = await this.fetchBundle(manifest.bundleUrl);
    const bytes = await this.readResponseBytes(response, reportProgress);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== manifest.bundleSha256) {
      throw new Error(`runtime bundle sha256 mismatch: expected ${manifest.bundleSha256} but got ${sha256}`);
    }
    this.assertBundleSignature(manifest, bytes);
    return bytes;
  };

  private fetchManifest = async (manifestUrl: string): Promise<UpdateManifest> => {
    if (manifestUrl.startsWith("file://")) {
      const manifest = this.manifestReader.parse(JSON.parse(readFileSync(fileURLToPath(manifestUrl), "utf8")), manifestUrl);
      return this.verifyManifest(manifest, manifestUrl);
    }
    const response = await this.fetchImpl(manifestUrl);
    if (!response.ok) {
      throw new Error(`runtime update manifest request failed with status ${response.status}`);
    }
    const manifest = this.manifestReader.parse(await response.json(), manifestUrl);
    return this.verifyManifest(manifest, manifestUrl);
  };

  private verifyManifest = (manifest: UpdateManifest, _manifestUrl: string): UpdateManifest => {
    if (manifest.hostKind && manifest.hostKind !== "npm-runtime-bundle") {
      throw new Error(`runtime update manifest hostKind mismatch: expected npm-runtime-bundle but got ${manifest.hostKind}`);
    }
    if (manifest.channel !== "stable" && manifest.channel !== "beta") {
      throw new Error(`runtime update manifest channel is unsupported: ${manifest.channel}`);
    }
    if (manifest.platform !== this.platform) {
      throw new Error(`runtime update manifest platform mismatch: expected ${this.platform} but got ${manifest.platform}`);
    }
    if (manifest.arch !== this.arch) {
      throw new Error(`runtime update manifest arch mismatch: expected ${this.arch} but got ${manifest.arch}`);
    }
    this.assertManifestSignature(manifest);
    return manifest;
  };

  private fetchBundle = async (bundleUrl: string): Promise<Response> => {
    if (bundleUrl.startsWith("file://")) {
      const bytes = readFileSync(fileURLToPath(bundleUrl));
      return new Response(bytes, {
        status: 200,
        headers: {
          "content-length": String(bytes.byteLength)
        }
      });
    }
    const response = await this.fetchImpl(bundleUrl);
    if (!response.ok) {
      throw new Error(`runtime bundle download failed with status ${response.status}`);
    }
    return response;
  };

  private readResponseBytes = async (
    response: Response,
    reportProgress?: NpmRuntimeUpdateProgressReporter
  ): Promise<Buffer> => {
    const totalBytes = this.readContentLength(response);
    if (!response.body) {
      const bytes = Buffer.from(await response.arrayBuffer());
      this.reportDownloadProgress(reportProgress, bytes.byteLength, totalBytes ?? bytes.byteLength);
      return bytes;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    this.reportDownloadProgress(reportProgress, downloadedBytes, totalBytes);
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      chunks.push(next.value);
      downloadedBytes += next.value.byteLength;
      this.reportDownloadProgress(reportProgress, downloadedBytes, totalBytes);
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  };

  private readContentLength = (response: Response): number | null => {
    const raw = response.headers.get("content-length");
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  private reportDownloadProgress = (
    reportProgress: NpmRuntimeUpdateProgressReporter | undefined,
    downloadedBytes: number,
    totalBytes: number | null
  ): void => {
    reportProgress?.({
      downloadedBytes,
      totalBytes,
      percent: totalBytes && totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null
    });
  };

  private findBundleRoot = (stagingRoot: string): string => {
    const directManifestPath = join(stagingRoot, "manifest.json");
    if (existsSync(directManifestPath)) {
      return stagingRoot;
    }
    const entries = readDirectoryNames(stagingRoot).filter((entry) => existsSync(join(stagingRoot, entry, "manifest.json")));
    if (entries.length === 1) {
      return join(stagingRoot, entries[0]);
    }
    throw new Error(`runtime bundle archive does not contain exactly one manifest root under ${stagingRoot}`);
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

  private assertManifestSignature = (manifest: UpdateManifest): void => {
    if (!this.bundlePublicKey) {
      throw new Error("runtime update manifest signature verification requires bundlePublicKey");
    }
    const signature = Buffer.from(manifest.manifestSignature, "base64");
    const valid = verify(null, Buffer.from(serializeUnsignedUpdateManifest(manifest)), this.bundlePublicKey, signature);
    if (!valid) {
      throw new Error(`runtime update manifest signature verification failed for ${manifest.latestVersion}`);
    }
  };

  private assertBundleSignature = (manifest: UpdateManifest, bytes: Buffer): void => {
    if (!this.bundlePublicKey) {
      throw new Error("runtime bundle signature verification requires bundlePublicKey");
    }
    const signature = Buffer.from(manifest.bundleSignature, "base64");
    const valid = verify(null, bytes, this.bundlePublicKey, signature);
    if (!valid) {
      throw new Error(`runtime bundle signature verification failed for ${manifest.latestVersion}`);
    }
  };
}

function readDirectoryNames(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}
