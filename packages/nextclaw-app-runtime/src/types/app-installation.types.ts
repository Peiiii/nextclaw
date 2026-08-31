import type {
  AppArtifactTarget,
  AppPermissions,
  AppResolvedComponent,
} from "#app-runtime/types/app-manifest.types.js";
import type {
  AppDocumentGrantMap,
  AppStoredDocumentGrantMap,
} from "#app-runtime/types/app-permissions.types.js";
import type { AppDistributionMode } from "#app-runtime/types/app-bundle.types.js";
import type { AppInstallSourceKind } from "#app-runtime/types/app-registry.types.js";
import type { AppPublisher } from "#app-runtime/types/app-remote-registry.types.js";
import type {
  AppInstanceRecord,
  AppStorageContext,
  AppStorageUsage,
} from "#app-runtime/types/app-storage.types.js";

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
  instance: AppInstanceRecord;
  sourceKind: AppInstallSourceKind;
  distributionMode?: AppDistributionMode;
  sourceRef: string;
  permissions: AppPermissions;
  registryUrl?: string;
  bundleUrl?: string;
  sha256?: string;
  target?: AppArtifactTarget;
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
  instance: AppInstanceRecord;
  storage: AppStorageContext;
  storageUsage?: AppStorageUsage;
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
    target?: AppArtifactTarget;
    publisher?: AppPublisher;
    manifestSchemaVersion: 1 | 2;
    components?: AppResolvedComponent[];
    primaryPanelId?: string;
    contentSha256?: string;
  }>;
  grants: AppStoredDocumentGrantMap;
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
  storage?: AppStorageContext;
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
