import type { AppPermissions } from "../manifest/app-manifest.types.js";
import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";

export type AppInstallSourceKind = "bundle" | "directory";

export type AppRegistryInstalledVersion = {
  version: string;
  installDirectory: string;
  sourceKind: AppInstallSourceKind;
  sourceRef: string;
  installedAt: string;
  permissions: AppPermissions;
};

export type AppRegistryAppRecord = {
  appId: string;
  name: string;
  description?: string;
  activeVersion: string;
  dataDirectory: string;
  installedVersions: Record<string, AppRegistryInstalledVersion>;
  grants: AppDocumentGrantMap;
};

export type AppRegistry = {
  schemaVersion: 1;
  apps: Record<string, AppRegistryAppRecord>;
};
