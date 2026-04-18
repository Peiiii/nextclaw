import { access } from "node:fs/promises";
import path from "node:path";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import { AppRegistryService } from "../registry/app-registry.service.js";
import type {
  AppDocumentGrantMutationResult,
  AppInstalledPermissionState,
} from "./app-permissions.types.js";

export class AppGrantService {
  constructor(
    private readonly registryService: AppRegistryService = new AppRegistryService(),
    private readonly manifestService: AppManifestService = new AppManifestService(),
  ) {}

  summarize = async (appId: string): Promise<AppInstalledPermissionState> => {
    const appRecord = await this.registryService.getApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    const activeVersion = appRecord.installedVersions[appRecord.activeVersion];
    if (!activeVersion) {
      throw new Error(`已安装应用缺少激活版本：${appId}`);
    }
    const bundle = await this.manifestService.load(activeVersion.installDirectory);
    const requestedPermissions = bundle.manifest.permissions ?? {};
    return {
      appId: appRecord.appId,
      name: appRecord.name,
      activeVersion: appRecord.activeVersion,
      documentAccess: (requestedPermissions.documentAccess ?? []).map((scope) => ({
        id: scope.id,
        mode: scope.mode,
        description: scope.description,
        granted: Boolean(appRecord.grants[scope.id]),
        grantedPath: appRecord.grants[scope.id],
      })),
      allowedDomains: requestedPermissions.allowedDomains ?? [],
      storage: {
        enabled:
          requestedPermissions.storage !== undefined &&
          requestedPermissions.storage !== false,
        namespace:
          typeof requestedPermissions.storage === "object"
            ? requestedPermissions.storage.namespace
            : undefined,
      },
      capabilities: {
        hostBridge: requestedPermissions.capabilities?.hostBridge !== false,
      },
    };
  };

  grantDocumentScope = async (params: {
    appId: string;
    scopeId: string;
    directoryPath: string;
  }): Promise<AppDocumentGrantMutationResult> => {
    const { appId, scopeId, directoryPath } = params;
    const permissionState = await this.summarize(appId);
    const requestedScope = permissionState.documentAccess.find(
      (scope) => scope.id === scopeId,
    );
    if (!requestedScope) {
      throw new Error(`应用 ${appId} 未声明 documentAccess scope：${scopeId}`);
    }
    const normalizedDirectory = path.resolve(directoryPath);
    try {
      await access(normalizedDirectory);
    } catch {
      throw new Error(`授权目录不存在：${normalizedDirectory}`);
    }
    await this.registryService.setDocumentGrant(
      appId,
      scopeId,
      normalizedDirectory,
    );
    return {
      appId,
      scopeId,
      grantedPath: normalizedDirectory,
    };
  };

  revokeDocumentScope = async (params: {
    appId: string;
    scopeId: string;
  }): Promise<AppDocumentGrantMutationResult> => {
    const { appId, scopeId } = params;
    await this.summarize(appId);
    const removed = await this.registryService.removeDocumentGrant(
      appId,
      scopeId,
    );
    return {
      appId,
      scopeId,
      removed,
    };
  };
}
