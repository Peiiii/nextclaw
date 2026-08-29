import { access, copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import {
  isAppComponentManifestBundle,
  isAppStandaloneManifestBundle,
} from "#app-runtime/types/app-manifest.types.js";
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
    if (isAppComponentManifestBundle(bundle)) {
      return await this.buildRustWasiComponent(appDirectory, bundle.components);
    }
    if (!isAppStandaloneManifestBundle(bundle)) {
      throw new Error("schema v2 组合包必须提交可直接运行的 bundle，不能执行本地 build。");
    }
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

  private buildRustWasiComponent = async (
    appDirectory: string,
    components: Array<{ kind: "panel" | "service"; componentDirectory: string }>,
  ): Promise<AppBuildResult> => {
    const serviceComponents = components.filter((component) => component.kind === "service");
    if (serviceComponents.length !== 1) {
      throw new Error(
        `Rust/WASI scaffold build requires exactly one Service Component; found ${serviceComponents.length}.`,
      );
    }
    const guestDirectory = path.join(appDirectory, "guest");
    const cargoTomlPath = path.join(guestDirectory, "Cargo.toml");
    const cargoLockPath = path.join(guestDirectory, "Cargo.lock");
    await Promise.all([access(cargoTomlPath), access(cargoLockPath)]);
    await this.toolchainService.assertReadyForWasiComponentBuild();
    await this.toolchainService.runCommand({
      command: "cargo",
      args: ["build", "--locked", "--release", "--target", "wasm32-wasip2"],
      cwd: guestDirectory,
    });
    const cargoToml = await readFile(cargoTomlPath, "utf8");
    const crateName = /^name\s*=\s*"([^"]+)"/m.exec(cargoToml)?.[1];
    if (!crateName) {
      throw new Error("Rust Guest Cargo.toml must declare package.name.");
    }
    const compiledPath = path.join(
      guestDirectory,
      "target",
      "wasm32-wasip2",
      "release",
      `${crateName.replace(/-/g, "_")}.wasm`,
    );
    const mainEntryPath = path.join(serviceComponents[0]!.componentDirectory, "service.wasm");
    await access(compiledPath);
    await copyFile(compiledPath, mainEntryPath);
    return {
      appDirectory,
      mainKind: "wasi-component",
      mainEntryPath,
      installedDependencies: false,
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
