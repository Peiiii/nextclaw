import { randomUUID } from "node:crypto";
import { chmod, cp, lstat, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { AppBuildService } from "#app-runtime/services/app-build.service.js";
import type { AppInstallationIntegrityService } from "#app-runtime/services/app-installation-integrity.service.js";
import type { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import { AppServiceLaunchService } from "#app-runtime/services/app-service-launch.service.js";
import {
  isAppComponentManifestBundle,
  isAppStandaloneManifestBundle,
  type AppManifestBundle,
  type AppNativeArtifactTarget,
} from "#app-runtime/types/app-manifest.types.js";
import type { AppDistributionMode } from "#app-runtime/types/app-bundle.types.js";

export class AppInstallationFilesystemService {
  constructor(private readonly params: {
    buildService: AppBuildService;
    integrityService: AppInstallationIntegrityService;
    manifestService: AppManifestService;
  }) {}

  copyToImmutableInstallDirectory = async (params: {
    appId: string;
    appVersion: string;
    extractedDirectory: string;
    installDirectory: string;
    target?: AppNativeArtifactTarget;
  }): Promise<string> => {
    const { appId, appVersion, extractedDirectory, installDirectory, target } = params;
    if (await this.params.integrityService.pathExists(installDirectory)) {
      throw new Error(`应用版本目录已存在，不能覆盖不可变版本：${appId}@${appVersion}`);
    }
    await mkdir(path.dirname(installDirectory), { recursive: true });
    const stagedInstallDirectory = `${installDirectory}.staging-${randomUUID()}`;
    try {
      await cp(extractedDirectory, stagedInstallDirectory, { recursive: true });
      const stagedManifest = await this.params.manifestService.load(stagedInstallDirectory);
      if (
        stagedManifest.manifest.id !== appId ||
        stagedManifest.manifest.version !== appVersion
      ) {
        throw new Error("staging manifest 与已验证 bundle 身份不一致。");
      }
      await this.restoreServiceCommandPermissions(stagedManifest, target);
      const contentSha256 = await this.params.integrityService.calculateDigest(
        stagedInstallDirectory,
      );
      await rename(stagedInstallDirectory, installDirectory);
      await this.params.integrityService.protectDirectory(installDirectory);
      return contentSha256;
    } catch (error) {
      await rm(stagedInstallDirectory, { recursive: true, force: true });
      throw error;
    }
  };

  private restoreServiceCommandPermissions = async (
    manifestBundle: AppManifestBundle,
    target?: AppNativeArtifactTarget,
  ): Promise<void> => {
    if (!isAppComponentManifestBundle(manifestBundle)) {
      return;
    }
    const launchService = new AppServiceLaunchService();
    for (const component of manifestBundle.components) {
      if (component.kind !== "service") {
        continue;
      }
      const serviceManifest = JSON.parse(
        await readFile(component.manifestPath, "utf8"),
      ) as Record<string, unknown>;
      if (serviceManifest.protocol === "wasi-component") {
        continue;
      }
      const { command } = launchService.resolve(serviceManifest, target);
      if (path.isAbsolute(command) || !command.includes("/")) {
        continue;
      }
      const commandPath = path.resolve(component.componentDirectory, command);
      const relativeCommandPath = path.relative(component.componentDirectory, commandPath);
      if (
        !relativeCommandPath ||
        relativeCommandPath.startsWith("..") ||
        path.isAbsolute(relativeCommandPath)
      ) {
        throw new Error(`service app command 必须位于组件目录内：${command}`);
      }
      const stats = await lstat(commandPath);
      if (!stats.isFile()) {
        throw new Error(`service app command 必须是普通文件：${command}`);
      }
      await chmod(commandPath, stats.mode | 0o100);
    }
  };

  materializeDistribution = async (params: {
    appDirectory: string;
    distributionMode: AppDistributionMode;
  }): Promise<void> => {
    if (params.distributionMode !== "source") {
      return;
    }
    const manifestBundle = await this.params.manifestService.load(params.appDirectory);
    if (!isAppStandaloneManifestBundle(manifestBundle)) {
      throw new Error("schema v2 组合包不允许运行安装期 build。");
    }
    if (manifestBundle.manifest.main.kind !== "wasi-http-component") {
      return;
    }
    await this.params.buildService.build({
      appDirectory: params.appDirectory,
      install: true,
    });
  };

  reconcileGeneratedSiblings = async (
    parentDirectory: string,
    referencedPaths: Set<string>,
  ): Promise<void> => {
    for (const entry of await this.readDirectories(parentDirectory)) {
      const entryName = path.basename(entry);
      if (entryName.includes(".staging-")) {
        await this.params.integrityService.removeDirectory(entry);
        continue;
      }
      const markerIndex = entryName.indexOf(".uninstalling-");
      if (markerIndex < 0) {
        continue;
      }
      const originalPath = path.join(parentDirectory, entryName.slice(0, markerIndex));
      if (
        referencedPaths.has(path.resolve(originalPath)) &&
        !await this.params.integrityService.pathExists(originalPath)
      ) {
        await rename(entry, originalPath);
      } else {
        await this.params.integrityService.removeDirectory(entry);
      }
    }
  };

  readDirectories = async (directory: string): Promise<string[]> => {
    try {
      return (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(directory, entry.name));
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return [];
      }
      throw error;
    }
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
