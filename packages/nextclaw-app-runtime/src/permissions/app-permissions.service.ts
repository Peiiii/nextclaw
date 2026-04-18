import { access } from "node:fs/promises";
import path from "node:path";
import type {
  AppDocumentAccessScope,
  AppManifestBundle,
} from "../manifest/app-manifest.types.js";
import type {
  AppDocumentGrantMap,
  AppPermissionSummary,
  ResolvedDocumentGrant,
  ResolvedPermissions,
} from "./app-permissions.types.js";

export class AppPermissionsService {
  resolve = async (
    bundle: AppManifestBundle,
    documentGrantMap: AppDocumentGrantMap,
    context?: {
      appId?: string;
    },
  ): Promise<ResolvedPermissions> => {
    const requestedPermissions = bundle.manifest.permissions ?? {};
    const documentAccess =
      requestedPermissions.documentAccess === undefined
        ? []
        : await Promise.all(
            requestedPermissions.documentAccess.map((scope) =>
              this.resolveDocumentGrant(scope, documentGrantMap, context?.appId),
            ),
          );

    return {
      documentAccess,
      allowedDomains: requestedPermissions.allowedDomains ?? [],
      storage: {
        enabled: requestedPermissions.storage !== undefined && requestedPermissions.storage !== false,
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

  summarize = (
    bundle: AppManifestBundle,
    permissions: ResolvedPermissions,
  ): AppPermissionSummary => {
    return {
      requested: bundle.manifest.permissions ?? {},
      documentAccess: permissions.documentAccess,
      allowedDomains: permissions.allowedDomains,
      storage: permissions.storage,
      capabilities: permissions.capabilities,
    };
  };

  private resolveDocumentGrant = async (
    scope: AppDocumentAccessScope,
    documentGrantMap: AppDocumentGrantMap,
    appId?: string,
  ): Promise<ResolvedDocumentGrant> => {
    const grantedPath = documentGrantMap[scope.id];
    if (!grantedPath) {
      if (appId) {
        throw new Error(
          `缺少 documentAccess 授权：${scope.id}。请先执行 napp grant ${appId} --document ${scope.id}=/absolute/path`,
        );
      }
      throw new Error(
        `缺少 documentAccess 授权：${scope.id}。请通过 --document ${scope.id}=/absolute/path 提供授权。`,
      );
    }
    const normalizedPath = path.resolve(grantedPath);
    try {
      await access(normalizedPath);
    } catch {
      throw new Error(`documentAccess 授权路径不存在：${scope.id} -> ${normalizedPath}`);
    }
    return {
      id: scope.id,
      mode: scope.mode,
      description: scope.description,
      path: normalizedPath,
    };
  };
}
