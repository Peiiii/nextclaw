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
  ): Promise<ResolvedPermissions> => {
    const requestedPermissions = bundle.manifest.permissions ?? {};
    const documentAccess =
      requestedPermissions.documentAccess === undefined
        ? []
        : await Promise.all(
            requestedPermissions.documentAccess.map((scope) =>
              this.resolveDocumentGrant(scope, documentGrantMap),
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
  ): Promise<ResolvedDocumentGrant> => {
    const grantedPath = documentGrantMap[scope.id];
    if (!grantedPath) {
      throw new Error(`缺少 documentAccess 授权：${scope.id}`);
    }
    const normalizedPath = path.resolve(grantedPath);
    await access(normalizedPath);
    return {
      id: scope.id,
      mode: scope.mode,
      description: scope.description,
      path: normalizedPath,
    };
  };
}
