import { existsSync, statSync } from "node:fs";
import { cp, readdir, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DesktopBundleManifestReader, type DesktopBundleManifest } from "../utils/bundle-manifest.utils";
import { compareDesktopVersions } from "../utils/version.utils";
import type { DesktopBundleLayoutStore } from "../stores/bundle-layout.store";
import type { DesktopLauncherStateStore } from "../stores/launcher-state.store";

export type ResolvedDesktopBundle = {
  bundleDirectory: string;
  manifest: DesktopBundleManifest;
  runtimeDirectory: string;
  uiDirectory: string;
  pluginsDirectory: string;
  runtimeScriptPath: string;
};

export type DesktopBundlePruneResult = {
  keptVersions: string[];
  removedVersions: string[];
  removedStagingEntries: string[];
};

function shouldRetryInstallWithCopy(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? String(error.code) : "";
  return code === "EXDEV" || code === "EPERM";
}

type DesktopBundleServiceOptions = {
  layout: DesktopBundleLayoutStore;
  stateStore?: DesktopLauncherStateStore;
  manifestReader?: DesktopBundleManifestReader;
  platform?: NodeJS.Platform;
  arch?: string;
  launcherVersion?: string;
  now?: () => number;
};

function assertDirectoryExists(targetPath: string, label: string): void {
  try {
    if (statSync(targetPath).isDirectory()) {
      return;
    }
  } catch {
    // Fall through to the shared error below.
  }
  throw new Error(`bundle ${label} directory missing: ${targetPath}`);
}

export class DesktopBundleService {
  private readonly manifestReader: DesktopBundleManifestReader;
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly launcherVersion: string | null;
  private readonly now: () => number;

  constructor(private readonly options: DesktopBundleServiceOptions) {
    this.manifestReader = options.manifestReader ?? new DesktopBundleManifestReader();
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.launcherVersion = options.launcherVersion?.trim() || null;
    this.now = options.now ?? Date.now;
  }

  resolveCurrentBundle = (): ResolvedDesktopBundle | null => {
    const pointer = this.options.layout.readCurrentPointer();
    if (!pointer) {
      return null;
    }
    const stateStore = this.getStateStore();
    const state = stateStore.read();
    if (state.currentVersion && state.currentVersion !== pointer.version) {
      throw new Error(
        `launcher state currentVersion (${state.currentVersion}) does not match current pointer (${pointer.version})`
      );
    }
    return this.resolveVersion(pointer.version);
  };

  resolveVersion = (version: string): ResolvedDesktopBundle => {
    const bundleDirectory = this.options.layout.getVersionDir(version);
    const resolvedBundle = this.verifyBundle(bundleDirectory);
    if (resolvedBundle.manifest.bundleVersion !== version) {
      throw new Error(
        `bundle version mismatch: pointer expects ${version} but manifest is ${resolvedBundle.manifest.bundleVersion}`
      );
    }
    return resolvedBundle;
  };

  installFromDirectory = async (sourceDirectory: string): Promise<ResolvedDesktopBundle> => {
    await this.options.layout.ensureLauncherDirs();

    const sourceBundle = this.verifyBundle(sourceDirectory);
    const version = sourceBundle.manifest.bundleVersion;
    const targetDirectory = this.options.layout.getVersionDir(version);
    if (existsSync(targetDirectory)) {
      return this.verifyBundle(targetDirectory);
    }

    if (resolve(sourceDirectory) === resolve(targetDirectory)) {
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

    const stagingDirectory = join(this.options.layout.getStagingDir(), `${version}-${this.now()}`);
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

  removeVersion = async (version: string): Promise<void> => {
    await rm(this.options.layout.getVersionDir(version), { recursive: true, force: true });
  };

  pruneRetainedArtifacts = async (): Promise<DesktopBundlePruneResult> => {
    await this.options.layout.ensureLauncherDirs();

    const retainedVersions = [...this.collectRetainedVersions()].sort(compareDesktopVersions);
    const removedVersions =
      retainedVersions.length > 0 ? await this.removeUnretainedVersions(new Set(retainedVersions)) : [];
    const removedStagingEntries = await this.clearStagingDirectory();

    return {
      keptVersions: retainedVersions,
      removedVersions,
      removedStagingEntries
    };
  };

  private verifyBundle = (bundleDirectory: string): ResolvedDesktopBundle => {
    const manifestPath = resolve(bundleDirectory, "manifest.json");
    const manifest = this.manifestReader.readFile(manifestPath);
    this.assertBundleCompatibility(manifest);

    const runtimeDirectory = resolve(bundleDirectory, "runtime");
    const uiDirectory = resolve(bundleDirectory, "ui");
    const pluginsDirectory = resolve(bundleDirectory, "plugins");
    const runtimeScriptPath = resolve(bundleDirectory, manifest.entrypoints.runtimeScript);

    assertDirectoryExists(runtimeDirectory, "runtime");
    assertDirectoryExists(uiDirectory, "ui");
    assertDirectoryExists(pluginsDirectory, "plugins");
    if (!existsSync(runtimeScriptPath)) {
      throw new Error(`bundle runtime script missing: ${runtimeScriptPath}`);
    }

    return {
      bundleDirectory,
      manifest,
      runtimeDirectory,
      uiDirectory,
      pluginsDirectory,
      runtimeScriptPath
    };
  };

  private collectRetainedVersions = (): Set<string> => {
    const retainedVersions = new Set<string>();
    const state = this.options.stateStore?.read();
    const currentPointer = this.options.layout.readCurrentPointer();
    const previousPointer = this.options.layout.readPreviousPointer();
    const versions = [
      state?.currentVersion,
      state?.previousVersion,
      state?.lastKnownGoodVersion,
      state?.candidateVersion,
      state?.downloadedVersion,
      currentPointer?.version,
      previousPointer?.version
    ];

    for (const version of versions) {
      if (version?.trim()) {
        retainedVersions.add(version);
      }
    }

    return retainedVersions;
  };

  private removeUnretainedVersions = async (retainedVersions: Set<string>): Promise<string[]> => {
    const removedVersions: string[] = [];
    const entries = await readdir(this.options.layout.getVersionsDir(), { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || retainedVersions.has(entry.name)) {
        continue;
      }
      await rm(join(this.options.layout.getVersionsDir(), entry.name), { recursive: true, force: true });
      removedVersions.push(entry.name);
    }

    return removedVersions.sort(compareDesktopVersions);
  };

  private clearStagingDirectory = async (): Promise<string[]> => {
    const removedEntries: string[] = [];
    const entries = await readdir(this.options.layout.getStagingDir(), { withFileTypes: true });

    for (const entry of entries) {
      await rm(join(this.options.layout.getStagingDir(), entry.name), { recursive: true, force: true });
      removedEntries.push(entry.name);
    }

    return removedEntries.sort();
  };

  private assertBundleCompatibility = (manifest: DesktopBundleManifest): void => {
    if (manifest.platform !== this.platform) {
      throw new Error(`bundle platform mismatch: expected ${this.platform} but got ${manifest.platform}`);
    }
    if (manifest.arch !== this.arch) {
      throw new Error(`bundle arch mismatch: expected ${this.arch} but got ${manifest.arch}`);
    }
    if (this.launcherVersion && compareDesktopVersions(this.launcherVersion, manifest.launcherCompatibility.minVersion) < 0) {
      throw new Error(
        `bundle requires launcher >= ${manifest.launcherCompatibility.minVersion} but current launcher is ${this.launcherVersion}`
      );
    }
  };

  private getStateStore = (): DesktopLauncherStateStore => {
    if (!this.options.stateStore) {
      throw new Error("bundle manager requires stateStore for current bundle resolution");
    }
    return this.options.stateStore;
  };
}
