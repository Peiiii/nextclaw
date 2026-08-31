import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import { AppRegistryService } from "#app-runtime/services/app-registry.service.js";
import type {
  AppDocumentGrantMutationResult,
  AppInstalledPermissionState,
} from "#app-runtime/types/app-permissions.types.js";

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
    const bundle = await this.manifestService.load(
      activeVersion.installDirectory,
    );
    const requestedPermissions = bundle.manifest.permissions ?? {};
    return {
      appId: appRecord.appId,
      name: appRecord.name,
      activeVersion: appRecord.activeVersion,
      documentAccess: await Promise.all(
        (requestedPermissions.documentAccess ?? []).map(async (scope) => {
          const grant = appRecord.grants[scope.id];
          const available = grant
            ? await this.isAvailableDirectory(grant.path)
            : false;
          const status = !grant
            ? ("ungranted" as const)
            : !available
              ? ("unavailable" as const)
              : ("granted" as const);
          return {
            id: scope.id,
            mode: scope.mode,
            description: scope.description,
            granted: Boolean(grant),
            grantedPath: grant?.path,
            effectiveMode: grant?.mode,
            grantedAt: grant?.grantedAt,
            status,
            availableActions: !grant
              ? ["grant" as const]
              : [
                  "replace" as const,
                  ...(grant.mode === "read" && scope.mode === "read-write"
                    ? ["upgrade" as const]
                    : []),
                  ...(grant.mode === "read-write"
                    ? ["downgrade" as const]
                    : []),
                  "revoke" as const,
                ],
          };
        }),
      ),
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
    mode?: "read" | "read-write";
  }): Promise<AppDocumentGrantMutationResult> => {
    const { appId, scopeId, directoryPath } = params;
    const permissionState = await this.summarize(appId);
    const requestedScope = permissionState.documentAccess.find(
      (scope) => scope.id === scopeId,
    );
    if (!requestedScope) {
      throw new Error(`应用 ${appId} 未声明 documentAccess scope：${scopeId}`);
    }
    const effectiveMode = params.mode ?? requestedScope.mode;
    if (
      effectiveMode === "read-write" &&
      requestedScope.mode !== "read-write"
    ) {
      throw new Error(
        `应用 ${appId} 的 documentAccess scope ${scopeId} 只声明了 read。`,
      );
    }
    const normalizedDirectory = path.resolve(directoryPath);
    let canonicalDirectory: string;
    try {
      canonicalDirectory = await realpath(normalizedDirectory);
      if (!(await stat(canonicalDirectory)).isDirectory()) {
        throw new Error("not-directory");
      }
    } catch {
      throw new Error(`授权资源不是可用目录：${normalizedDirectory}`);
    }
    await this.registryService.setDocumentGrant(
      appId,
      scopeId,
      canonicalDirectory,
      effectiveMode,
    );
    return {
      appId,
      scopeId,
      grantedPath: canonicalDirectory,
      effectiveMode,
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

  private isAvailableDirectory = async (
    directoryPath: string,
  ): Promise<boolean> => {
    try {
      return (await stat(await realpath(directoryPath))).isDirectory();
    } catch {
      return false;
    }
  };
}
