import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createExternalCommandEnv } from "@nextclaw/core";
import { NpmRuntimeBundleLayoutStore } from "@nextclaw-service/stores/npm-runtime-bundle-layout.store.js";
import {
  isNpmRuntimeBundleComplete,
  isPackagedNpmRuntimeComplete,
  compareNpmRuntimeVersions,
  NpmRuntimeBundleService,
  shouldPreferPackagedNpmRuntime,
  type ResolvedNpmRuntimeBundle
} from "@nextclaw-service/services/runtime/npm-runtime-bundle.service.js";
import { NpmRuntimeUpdateCommandService } from "@nextclaw-service/services/runtime/npm-runtime-update-command.service.js";
import { inferDefaultNpmRuntimeReleaseChannel } from "@nextclaw-service/services/runtime/npm-runtime-update-source.service.js";
import { NpmRuntimeUpdateStateStore } from "@nextclaw-service/stores/npm-runtime-update-state.store.js";
import { getPackageVersion } from "@nextclaw-service/utils/cli.utils.js";

type NpmRuntimeLauncherOptions = {
  argv: string[];
  env?: NodeJS.ProcessEnv;
  layout?: NpmRuntimeBundleLayoutStore;
  launcherVersion?: string;
  packagedAppEntrypoint?: string;
  packagedPortableRunnerPath?: string;
  bootstrapRuntimeBundle?: () => Promise<void>;
};

export class NpmRuntimeLauncher {
  private readonly env: NodeJS.ProcessEnv;
  private readonly layout: NpmRuntimeBundleLayoutStore;

  constructor(private readonly options: NpmRuntimeLauncherOptions) {
    this.env = options.env ?? process.env;
    this.layout = options.layout ?? new NpmRuntimeBundleLayoutStore();
  }

  run = async (): Promise<never> => {
    const runtimeScriptPath = await this.resolveRuntimeScriptPath();
    const launcherVersion = this.resolveLauncherVersion();
    const launcherEntrypoint = this.options.argv[1]?.trim();
    const result = spawnSync(process.execPath, [runtimeScriptPath, ...this.options.argv.slice(2)], {
      stdio: "inherit",
      env: {
        ...createExternalCommandEnv(this.env),
        NEXTCLAW_RUNTIME_BUNDLE_CHILD: "1",
        NEXTCLAW_NPM_LAUNCHER_VERSION: launcherVersion,
        ...(launcherEntrypoint ? { NEXTCLAW_NPM_LAUNCHER_ENTRYPOINT: launcherEntrypoint } : {})
      },
      windowsHide: true
    });
    process.exit(typeof result.status === "number" ? result.status : 1);
  };

  private resolveRuntimeScriptPath = async (): Promise<string> => {
    const launcherVersion = this.resolveLauncherVersion();
    if (this.env.NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER === "1" || this.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD === "1") {
      return this.resolvePackagedAppEntrypoint();
    }
    const stateStore = new NpmRuntimeUpdateStateStore(this.layout.getStatePath(), {
      defaultChannel: inferDefaultNpmRuntimeReleaseChannel(launcherVersion)
    });
    const bundleService = new NpmRuntimeBundleService({
      layout: this.layout,
      stateStore,
      launcherVersion
    });
    let currentBundle: ResolvedNpmRuntimeBundle | null = null;
    try {
      currentBundle = bundleService.resolveCurrentBundle();
    } catch (error) {
      console.error(`Cannot start current runtime bundle: ${error instanceof Error ? error.message : String(error)}`);
    }
    const packagedRuntimeComplete = isPackagedNpmRuntimeComplete({
      runnerPath: this.options.packagedPortableRunnerPath
    });
    const currentBundleComplete = Boolean(currentBundle && isNpmRuntimeBundleComplete({
      bundleDirectory: currentBundle.bundleDirectory
    }));
    const currentRuntimeVersion = currentBundle?.manifest.runtimeVersion ?? currentBundle?.manifest.bundleVersion;
    const launcherHasNewerRuntime = Boolean(
      currentBundleComplete
      && currentRuntimeVersion
      && compareNpmRuntimeVersions(launcherVersion, currentRuntimeVersion) > 0,
    );
    if (
      packagedRuntimeComplete &&
      (!currentBundleComplete || (currentBundle && shouldPreferPackagedNpmRuntime({
        launcherVersion,
        currentBundleVersion: currentBundle.manifest.runtimeVersion ?? currentBundle.manifest.bundleVersion,
        packagedRuntimeComplete
      })))
    ) {
      return this.resolvePackagedAppEntrypoint();
    }
    if (
      currentBundleComplete &&
      currentBundle &&
      (currentBundle.manifest.runtimeVersion ?? currentBundle.manifest.bundleVersion) === launcherVersion
    ) {
      return currentBundle.runtimeScriptPath;
    }
    if (!packagedRuntimeComplete || !currentBundleComplete || launcherHasNewerRuntime) {
      try {
        await this.bootstrapRuntimeBundle();
        const bootstrappedBundle = bundleService.resolveCurrentBundle();
        if (bootstrappedBundle && isNpmRuntimeBundleComplete({ bundleDirectory: bootstrappedBundle.bundleDirectory })) {
          return bootstrappedBundle.runtimeScriptPath;
        }
        return currentBundle?.runtimeScriptPath ?? this.resolveIncompletePackagedRuntime();
      } catch (error) {
        console.error(`Cannot bootstrap the complete runtime bundle: ${error instanceof Error ? error.message : String(error)}`);
        if (currentBundle) {
          console.error(`Continuing with the previously installed runtime bundle ${currentBundle.manifest.runtimeVersion}.`);
          return currentBundle.runtimeScriptPath;
        }
        return this.resolveIncompletePackagedRuntime();
      }
    }
    return currentBundle?.runtimeScriptPath ?? this.resolvePackagedAppEntrypoint();
  };

  private bootstrapRuntimeBundle = async (): Promise<void> => {
    if (this.options.bootstrapRuntimeBundle) {
      await this.options.bootstrapRuntimeBundle();
      return;
    }
    const snapshot = await new NpmRuntimeUpdateCommandService(this.env).runManaged({});
    if (snapshot.status === "blocked" || snapshot.status === "failed") {
      throw new Error(snapshot.errorMessage ?? snapshot.blockReason ?? "runtime bundle bootstrap failed");
    }
  };

  private resolveIncompletePackagedRuntime = (): string => {
    console.error("The packaged npm runtime is missing the current platform runner; Portable Service Apps remain unavailable until runtime bootstrap succeeds.");
    return this.resolvePackagedAppEntrypoint();
  };

  private resolveLauncherVersion = (): string => this.options.launcherVersion ?? getPackageVersion();

  private resolvePackagedAppEntrypoint = (): string => {
    if (this.options.packagedAppEntrypoint) {
      return this.options.packagedAppEntrypoint;
    }
    return resolve(dirname(fileURLToPath(import.meta.url)), "../app/index.js");
  };
}
