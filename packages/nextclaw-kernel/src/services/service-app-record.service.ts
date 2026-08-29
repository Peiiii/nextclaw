import { access } from "node:fs/promises";
import { basename, join } from "node:path";
import { AppInstanceStorageService } from "@nextclaw/app-runtime";
import type { AppStorageContext } from "@nextclaw/app-runtime";
import type { AppPackageComponentSource } from "@kernel/types/app-package.types.js";
import type { ServiceAppManifest, ServiceAppRecord } from "@kernel/types/service-app.types.js";
import {
  getServiceAppManifestPath,
  readServiceAppManifest,
} from "@kernel/utils/service-app-manifest.utils.js";
type ServiceAppStatusReader = {
  getStatus: (appId: string) => {
    status: ServiceAppRecord["status"];
    lastError?: string;
    lastStartedAt?: string;
    lastReadyAt?: string;
    lastFailedAt?: string;
  };
};

export type WorkspaceServiceDataOwner = {
  id: string;
  title: string;
};

export class ServiceAppRecordService {
  private readonly instanceStorageService = new AppInstanceStorageService();

  constructor(private readonly params: {
    getWorkspacePath: () => string;
    runtimeService: ServiceAppStatusReader;
  }) {}

  buildWorkspaceRecord = async (
    serviceAppsPath: string,
    dirName: string,
  ): Promise<ServiceAppRecord | null> => {
    const dirPath = join(serviceAppsPath, dirName);
    try {
      const manifest = await readServiceAppManifest(dirPath);
      if (manifest.id !== dirName) {
        throw new Error(`service app manifest id must match directory name: ${dirName}`);
      }
      return this.fromManifest(
        dirPath,
        manifest,
        undefined,
        await this.inspectWorkspaceStorage(manifest.id),
      );
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return null;
      }
      return this.failedWorkspaceRecord(dirName, dirPath, error);
    }
  };

  buildPackageRecord = async (
    source: AppPackageComponentSource,
  ): Promise<ServiceAppRecord | null> => {
    try {
      const manifest = await readServiceAppManifest(source.sourcePath);
      if (manifest.id !== source.id) {
        throw new Error(`service component id mismatch: ${source.id}`);
      }
      return this.fromManifest(source.sourcePath, manifest, source, source.storage);
    } catch (error) {
      return this.failedPackageRecord(source, error);
    }
  };

  listWorkspaceDataOwners = async (
    serviceAppsPath: string,
    dirNames: string[],
  ): Promise<WorkspaceServiceDataOwner[]> => {
    const owners = await Promise.all(dirNames.map(async (dirName) => {
      try {
        const manifest = await readServiceAppManifest(join(serviceAppsPath, dirName));
        return manifest.id === dirName
          ? { id: manifest.id, title: manifest.title }
          : null;
      } catch {
        return null;
      }
    }));
    return owners.filter((entry): entry is WorkspaceServiceDataOwner => Boolean(entry));
  };

  materializeWorkspaceStorage = async (serviceId: string): Promise<AppStorageContext> => {
    const instanceDirectory = this.getWorkspaceInstanceDirectory(serviceId);
    return (await this.instanceStorageService.materialize({
      appId: serviceId,
      instanceId: "default",
      instanceDirectory,
    })).storage;
  };

  inspectWorkspaceStorage = async (serviceId: string): Promise<AppStorageContext | undefined> => {
    const instanceDirectory = this.getWorkspaceInstanceDirectory(serviceId);
    if (!await this.pathExists(instanceDirectory)) {
      return undefined;
    }
    return (await this.instanceStorageService.inspect({
      appId: serviceId,
      instanceId: "default",
      instanceDirectory,
    })).storage;
  };

  fromManifest = (
    dirPath: string,
    manifest: ServiceAppManifest,
    packageSource?: AppPackageComponentSource,
    storage?: AppStorageContext,
  ): ServiceAppRecord => {
    const runtimeStatus = this.params.runtimeService.getStatus(manifest.id);
    return {
      id: manifest.id,
      title: manifest.title,
      description: manifest.description,
      dirPath,
      manifestPath: getServiceAppManifestPath(dirPath),
      command: manifest.command,
      args: manifest.args,
      cwd: dirPath,
      enabled: packageSource ? true : manifest.enabled,
      protocol: manifest.protocol,
      status: packageSource || manifest.enabled ? runtimeStatus.status : "stopped",
      lastError: runtimeStatus.lastError,
      lastStartedAt: runtimeStatus.lastStartedAt,
      lastReadyAt: runtimeStatus.lastReadyAt,
      lastFailedAt: runtimeStatus.lastFailedAt,
      sourceKind: packageSource ? "package" : "workspace",
      packageId: packageSource?.packageId,
      packageVersion: packageSource?.packageVersion,
      packageDirectory: packageSource ? join(packageSource.sourcePath, "..", "..") : undefined,
      dataDirectory: storage?.dataDirectory,
      instanceId: packageSource?.instanceId ?? storage?.instanceId,
      storage,
      isolation: packageSource?.isolation ?? "full-user",
      runtimeProfile: packageSource?.runtimeProfile ?? "native-process",
      permissions: packageSource?.permissions ?? {},
      componentPath: manifest.componentEntry ? join(dirPath, manifest.componentEntry) : undefined,
      providerIds: Array.from(new Set([
        ...(manifest.providerIds ?? []),
        ...(packageSource?.resolvedProviderIds ?? []),
      ])),
      lifecycle: manifest.lifecycle,
    };
  };

  private failedWorkspaceRecord = (
    id: string,
    dirPath: string,
    error: unknown,
  ): ServiceAppRecord => ({
    id,
    title: this.toTitle(id),
    dirPath,
    manifestPath: getServiceAppManifestPath(dirPath),
    cwd: dirPath,
    enabled: false,
    protocol: "mcp",
    status: "failed",
    lastError: error instanceof Error ? error.message : String(error),
  });

  private failedPackageRecord = (
    source: AppPackageComponentSource,
    error: unknown,
  ): ServiceAppRecord => ({
    id: source.id,
    title: this.toTitle(source.id),
    dirPath: source.sourcePath,
    manifestPath: source.manifestPath,
    cwd: source.sourcePath,
    enabled: false,
    protocol: "mcp",
    status: "failed",
    lastError: error instanceof Error ? error.message : String(error),
    sourceKind: "package",
    packageId: source.packageId,
    packageVersion: source.packageVersion,
    packageDirectory: join(source.sourcePath, "..", ".."),
    dataDirectory: source.dataDirectory,
    instanceId: source.instanceId,
    storage: source.storage,
    isolation: source.isolation,
    runtimeProfile: source.runtimeProfile,
    permissions: source.permissions,
  });

  private toTitle = (value: string): string =>
    basename(value).replace(/[-_]+/g, " ").trim() || value;

  private getWorkspaceInstanceDirectory = (serviceId: string): string => join(
    this.params.getWorkspacePath(),
    ".nextclaw",
    "app-instances",
    serviceId,
    "default",
  );

  private pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return false;
      }
      throw error;
    }
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    (error as { code?: unknown }).code === "ENOENT";
}
