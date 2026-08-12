import type { AppPermissions, AppResolvedComponent } from "#app-runtime/types/app-manifest.types.js";
import type { AppDocumentGrantMap } from "#app-runtime/types/app-permissions.types.js";
import type { AppDistributionMode } from "#app-runtime/types/app-bundle.types.js";
import type { AppInstallSourceKind } from "#app-runtime/types/app-registry.types.js";
import type { AppPublisher } from "#app-runtime/types/app-remote-registry.types.js";

export type AppInstallProgressPhase =
  | "resolving"
  | "downloading"
  | "verifying"
  | "installing"
  | "finalizing";

export type AppInstallProgressHandler = (
  phase: AppInstallProgressPhase,
) => void | Promise<void>;

export type AppInstallResult = {
  appId: string;
  name: string;
  version: string;
  installDirectory: string;
  dataDirectory: string;
  sourceKind: AppInstallSourceKind;
  distributionMode?: AppDistributionMode;
  sourceRef: string;
  permissions: AppPermissions;
  registryUrl?: string;
  bundleUrl?: string;
  sha256?: string;
  publisher?: AppPublisher;
  enabled: boolean;
  manifestSchemaVersion: 1 | 2;
  components?: AppResolvedComponent[];
  primaryPanelId?: string;
};

export type AppInfoResult = {
  appId: string;
  name: string;
  description?: string;
  activeVersion: string;
  enabled: boolean;
  dataDirectory: string;
  installedVersions: Array<{
    version: string;
    installDirectory: string;
    sourceKind: AppInstallSourceKind;
    distributionMode?: AppDistributionMode;
    sourceRef: string;
    installedAt: string;
    permissions: AppPermissions;
    registryUrl?: string;
    bundleUrl?: string;
    sha256?: string;
    publisher?: AppPublisher;
    manifestSchemaVersion: 1 | 2;
    components?: AppResolvedComponent[];
    primaryPanelId?: string;
  }>;
  grants: AppDocumentGrantMap;
};

export type InstalledAppListItem = {
  appId: string;
  name: string;
  activeVersion: string;
  sourceKind: AppInstallSourceKind;
  distributionMode?: AppDistributionMode;
  enabled: boolean;
  manifestSchemaVersion: 1 | 2;
  primaryPanelId?: string;
};

export type AppUninstallResult = {
  appId: string;
  removedVersions: string[];
  dataRemoved: boolean;
};

export type AppLaunchResolution = {
  appDirectory: string;
  appId?: string;
  dataDirectory?: string;
  documentGrantMap: AppDocumentGrantMap;
};

export type AppUpdateResult = AppInstallResult & {
  previousVersion: string;
  updated: boolean;
};

export type AppActivationResult = {
  appId: string;
  activeVersion: string;
  enabled: boolean;
};

export type AppRollbackResult = AppActivationResult & {
  previousVersion: string;
  rolledBack: boolean;
};
