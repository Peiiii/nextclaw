import { existsSync } from "node:fs";
import { cp, readdir, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { NpmRuntimeBundleManifestReader } from "./npm-runtime-bundle-manifest.service.js";
import type { NpmRuntimeBundleLayoutStore } from "./npm-runtime-bundle-layout.store.js";
import type { NpmRuntimeBundleManifest } from "./npm-runtime-bundle.types.js";
import type { NpmRuntimeUpdateStateStore } from "./npm-runtime-update-state.store.js";

export type ResolvedNpmRuntimeBundle = {
  bundleDirectory: string;
  manifest: NpmRuntimeBundleManifest;
  runtimeScriptPath: string;
};

type NpmRuntimeBundleServiceOptions = {
  layout: NpmRuntimeBundleLayoutStore;
  stateStore: NpmRuntimeUpdateStateStore;
  manifestReader?: NpmRuntimeBundleManifestReader;
  platform?: NodeJS.Platform;
  arch?: string;
  launcherVersion?: string;
  now?: () => number;
};

function shouldRetryInstallWithCopy(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? String(error.code) : "";
  return code === "EXDEV" || code === "EPERM";
}

export class NpmRuntimeBundleService {
  private readonly manifestReader: NpmRuntimeBundleManifestReader;
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly launcherVersion: string | null;
  private readonly now: () => number;

  constructor(private readonly options: NpmRuntimeBundleServiceOptions) {
    this.manifestReader = options.manifestReader ?? new NpmRuntimeBundleManifestReader();
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.launcherVersion = options.launcherVersion?.trim() || null;
    this.now = options.now ?? Date.now;
  }

  resolveCurrentBundle = (): ResolvedNpmRuntimeBundle | null => {
    const pointer = this.options.layout.readCurrentPointer();
    if (!pointer) {
      return null;
    }
    return this.resolveVersion(pointer.version);
  };

  resolveVersion = (version: string): ResolvedNpmRuntimeBundle => {
    const bundleDirectory = this.options.layout.getVersionDir(version);
    const bundle = this.verifyBundle(bundleDirectory);
    if (bundle.manifest.bundleVersion !== version) {
      throw new Error(`runtime bundle version mismatch: pointer expects ${version} but manifest is ${bundle.manifest.bundleVersion}`);
    }
    return bundle;
  };

  installFromDirectory = async (sourceDirectory: string): Promise<ResolvedNpmRuntimeBundle> => {
    this.options.layout.ensureLauncherDirs();
    const sourceBundle = this.verifyBundle(sourceDirectory);
    const targetDirectory = this.options.layout.getVersionDir(sourceBundle.manifest.bundleVersion);
    if (existsSync(targetDirectory)) {
      return this.verifyBundle(targetDirectory);
    }

    try {
      await rename(sourceDirectory, targetDirectory);
      return this.verifyBundle(targetDirectory);
    } catch (error) {
      if (!shouldRetryInstallWithCopy(error)) {
        throw error;
      }
    }

    const stagingDirectory = join(this.options.layout.getStagingDir(), `${sourceBundle.manifest.bundleVersion}-${this.now()}`);
    await rm(stagingDirectory, { recursive: true, force: true });
    try {
      await cp(sourceDirectory, stagingDirectory, { recursive: true });
      await rename(stagingDirectory, targetDirectory);
      return this.verifyBundle(targetDirectory);
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    }
  };

  activateVersion = (version: string): void => {
    this.resolveVersion(version);
    const currentPointer = this.options.layout.readCurrentPointer();
    if (currentPointer) {
      this.options.layout.writePreviousPointer(currentPointer);
    }
    this.options.layout.writeCurrentPointer({ version });
    this.options.stateStore.update((state) => ({
      ...state,
      currentVersion: version,
      previousVersion: currentPointer?.version ?? state.previousVersion,
      candidateVersion: version,
      candidateLaunchCount: 0,
      downloadedVersion: null,
      downloadedReleaseNotesUrl: null
    }));
  };

  pruneRetainedArtifacts = async (): Promise<void> => {
    this.options.layout.ensureLauncherDirs();
    const state = this.options.stateStore.read();
    const retained = new Set(
      [
        state.currentVersion,
        state.previousVersion,
        state.candidateVersion,
        state.lastKnownGoodVersion,
        state.downloadedVersion,
        this.options.layout.readCurrentPointer()?.version,
        this.options.layout.readPreviousPointer()?.version
      ].filter((version): version is string => Boolean(version?.trim()))
    );

    const entries = await readdir(this.options.layout.getVersionsDir(), { withFileTypes: true });
    for (const entry of entries.sort((left, right) => compareNpmRuntimeVersions(left.name, right.name))) {
      if (!entry.isDirectory() || retained.has(entry.name)) {
        continue;
      }
      await rm(join(this.options.layout.getVersionsDir(), entry.name), { recursive: true, force: true });
    }
    await this.clearStagingDirectory();
  };

  private clearStagingDirectory = async (): Promise<void> => {
    const entries = await readdir(this.options.layout.getStagingDir(), { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => await rm(join(this.options.layout.getStagingDir(), entry.name), { recursive: true, force: true })));
  };

  private verifyBundle = (bundleDirectory: string): ResolvedNpmRuntimeBundle => {
    const manifest = this.manifestReader.readFile(resolve(bundleDirectory, "manifest.json"));
    if (manifest.platform !== this.platform) {
      throw new Error(`runtime bundle platform mismatch: expected ${this.platform} but got ${manifest.platform}`);
    }
    if (manifest.arch !== this.arch) {
      throw new Error(`runtime bundle arch mismatch: expected ${this.arch} but got ${manifest.arch}`);
    }
    if (this.launcherVersion && compareNpmRuntimeVersions(this.launcherVersion, manifest.launcherCompatibility.minVersion) < 0) {
      throw new Error(`runtime bundle requires launcher >= ${manifest.launcherCompatibility.minVersion} but current launcher is ${this.launcherVersion}`);
    }
    const runtimeScriptPath = resolve(bundleDirectory, manifest.entrypoints.runtimeScript);
    if (!existsSync(runtimeScriptPath)) {
      throw new Error(`runtime bundle script missing: ${runtimeScriptPath}`);
    }
    return {
      bundleDirectory,
      manifest,
      runtimeScriptPath
    };
  };
}

export function compareNpmRuntimeVersions(left: string, right: string): number {
  const [leftCore = "", leftPrerelease = ""] = left.split("+")[0]?.split("-", 2) ?? [];
  const [rightCore = "", rightPrerelease = ""] = right.split("+")[0]?.split("-", 2) ?? [];
  const leftParts = parseVersionParts(leftCore);
  const rightParts = parseVersionParts(rightCore);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const compared = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (compared !== 0) {
      return compared;
    }
  }
  if (!leftPrerelease || !rightPrerelease) {
    return Number(!leftPrerelease) - Number(!rightPrerelease);
  }
  return leftPrerelease.localeCompare(rightPrerelease, undefined, { numeric: true });
}

export function resolveEffectiveNpmRuntimeVersion(params: {
  launcherVersion: string | null;
  currentBundleVersion: string | null;
}): string | null {
  const launcherVersion = params.launcherVersion?.trim() || null;
  const currentBundleVersion = params.currentBundleVersion?.trim() || null;
  if (!launcherVersion) {
    return currentBundleVersion;
  }
  if (!currentBundleVersion) {
    return launcherVersion;
  }
  return compareNpmRuntimeVersions(launcherVersion, currentBundleVersion) > 0
    ? launcherVersion
    : currentBundleVersion;
}

export function shouldPreferPackagedNpmRuntime(params: {
  launcherVersion: string | null;
  currentBundleVersion: string | null;
}): boolean {
  const launcherVersion = params.launcherVersion?.trim() || null;
  return Boolean(launcherVersion) && resolveEffectiveNpmRuntimeVersion(params) === launcherVersion;
}

function parseVersionParts(version: string): number[] {
  return version
    .split(".")
    .map((part) => Number(part))
    .map((part) => (Number.isFinite(part) ? part : 0));
}
