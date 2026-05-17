import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createExternalCommandEnv } from "@nextclaw/core";
import { NpmRuntimeBundleLayoutStore } from "./npm-runtime-bundle-layout.store.js";
import { NpmRuntimeBundleService, shouldPreferPackagedNpmRuntime } from "./npm-runtime-bundle.service.js";
import { inferDefaultNpmRuntimeReleaseChannel } from "./npm-runtime-update-source.service.js";
import { NpmRuntimeUpdateStateStore } from "./npm-runtime-update-state.store.js";
import { getPackageVersion } from "@nextclaw-service/shared/utils/cli.utils.js";

type NpmRuntimeLauncherOptions = {
  argv: string[];
  env?: NodeJS.ProcessEnv;
  layout?: NpmRuntimeBundleLayoutStore;
  launcherVersion?: string;
  packagedAppEntrypoint?: string;
};

export class NpmRuntimeLauncher {
  private readonly env: NodeJS.ProcessEnv;
  private readonly layout: NpmRuntimeBundleLayoutStore;

  constructor(private readonly options: NpmRuntimeLauncherOptions) {
    this.env = options.env ?? process.env;
    this.layout = options.layout ?? new NpmRuntimeBundleLayoutStore();
  }

  run = (): never => {
    const runtimeScriptPath = this.resolveRuntimeScriptPath();
    const result = spawnSync(process.execPath, [runtimeScriptPath, ...this.options.argv.slice(2)], {
      stdio: "inherit",
      env: {
        ...createExternalCommandEnv(this.env),
        NEXTCLAW_RUNTIME_BUNDLE_CHILD: "1"
      },
      windowsHide: true
    });
    process.exit(typeof result.status === "number" ? result.status : 1);
  };

  private resolveRuntimeScriptPath = (): string => {
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
    try {
      const currentBundle = bundleService.resolveCurrentBundle();
      if (
        currentBundle &&
        shouldPreferPackagedNpmRuntime({
          launcherVersion,
          currentBundleVersion: currentBundle.manifest.runtimeVersion ?? currentBundle.manifest.bundleVersion
        })
      ) {
        return this.resolvePackagedAppEntrypoint();
      }
      return currentBundle?.runtimeScriptPath ?? this.resolvePackagedAppEntrypoint();
    } catch (error) {
      console.error(`Cannot start current runtime bundle: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Falling back to the packaged npm launcher runtime.");
      return this.resolvePackagedAppEntrypoint();
    }
  };

  private resolveLauncherVersion = (): string => this.options.launcherVersion ?? getPackageVersion();

  private resolvePackagedAppEntrypoint = (): string => {
    if (this.options.packagedAppEntrypoint) {
      return this.options.packagedAppEntrypoint;
    }
    return resolve(dirname(fileURLToPath(import.meta.url)), "../app/index.js");
  };
}
