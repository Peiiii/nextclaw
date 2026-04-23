import { access } from "node:fs/promises";
import path from "node:path";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import { AppRuntimeToolchainService } from "./app-runtime-toolchain.service.js";

export type AppBuildResult = {
  appDirectory: string;
  mainKind: string;
  mainEntryPath: string;
  installedDependencies: boolean;
  built: boolean;
  skippedReason?: string;
};

export class AppBuildService {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
    private readonly toolchainService: AppRuntimeToolchainService = new AppRuntimeToolchainService(),
  ) {}

  build = async (params: {
    appDirectory: string;
    install: boolean;
  }): Promise<AppBuildResult> => {
    const appDirectory = path.resolve(params.appDirectory);
    const bundle = await this.manifestService.load(appDirectory);
    if (bundle.manifest.main.kind !== "wasi-http-component") {
      return {
        appDirectory,
        mainKind: bundle.manifest.main.kind,
        mainEntryPath: bundle.mainEntryPath,
        installedDependencies: false,
        built: false,
        skippedReason: "main.kind=wasm 应用不需要 TS/WASI HTTP 构建。",
      };
    }

    await this.toolchainService.assertReadyForWasiHttpBuild();
    const mainDirectory = path.join(appDirectory, "main");
    await access(path.join(mainDirectory, "package.json"));
    const shouldInstall = params.install || !(await this.pathExists(path.join(mainDirectory, "node_modules")));
    if (shouldInstall) {
      await this.toolchainService.runCommand({
        command: "npm",
        args: ["install"],
        cwd: mainDirectory,
      });
    }
    await this.toolchainService.runCommand({
      command: "npm",
      args: ["run", "build"],
      cwd: mainDirectory,
    });
    await access(bundle.mainEntryPath);
    return {
      appDirectory,
      mainKind: bundle.manifest.main.kind,
      mainEntryPath: bundle.mainEntryPath,
      installedDependencies: shouldInstall,
      built: true,
    };
  };

  private pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  };
}
