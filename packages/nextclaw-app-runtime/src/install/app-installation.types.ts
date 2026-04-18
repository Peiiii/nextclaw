import type { AppPermissions } from "../manifest/app-manifest.types.js";
import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";
import type { AppInstallSourceKind } from "../registry/app-registry.types.js";
import type { AppPublisher } from "../registry/app-remote-registry.types.js";

export type AppInstallResult = {
  appId: string;
  name: string;
  version: string;
  installDirectory: string;
  dataDirectory: string;
  sourceKind: AppInstallSourceKind;
  sourceRef: string;
  permissions: AppPermissions;
  registryUrl?: string;
  bundleUrl?: string;
  sha256?: string;
  publisher?: AppPublisher;
};

export type AppInfoResult = {
  appId: string;
  name: string;
  description?: string;
  activeVersion: string;
  dataDirectory: string;
  installedVersions: Array<{
    version: string;
    installDirectory: string;
    sourceKind: AppInstallSourceKind;
    sourceRef: string;
    installedAt: string;
    permissions: AppPermissions;
    registryUrl?: string;
    bundleUrl?: string;
    sha256?: string;
    publisher?: AppPublisher;
  }>;
  grants: AppDocumentGrantMap;
};

export type InstalledAppListItem = {
  appId: string;
  name: string;
  activeVersion: string;
  sourceKind: AppInstallSourceKind;
};

export type AppUninstallResult = {
  appId: string;
  removedVersions: string[];
  dataRemoved: boolean;
};

export type AppLaunchResolution = {
  appDirectory: string;
  appId?: string;
  documentGrantMap: AppDocumentGrantMap;
};

export type AppUpdateResult = AppInstallResult & {
  previousVersion: string;
  updated: boolean;
};
