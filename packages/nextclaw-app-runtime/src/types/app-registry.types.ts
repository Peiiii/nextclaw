import type {
  AppArtifactTarget,
  AppPermissions,
  AppPlatformSecuritySummary,
  AppResolvedComponent,
} from "#app-runtime/types/app-manifest.types.js";
import type { AppDocumentGrantMap } from "#app-runtime/types/app-permissions.types.js";
import type { AppDistributionMode } from "#app-runtime/types/app-bundle.types.js";
import type { AppPublisher } from "#app-runtime/types/app-remote-registry.types.js";
import type { AppInstanceRecord } from "#app-runtime/types/app-storage.types.js";

export type AppSecretBinding = {
  source: "env" | "file" | "exec";
  provider?: string;
  id: string;
};

export type AppSecretBindingMap = Record<string, AppSecretBinding>;

export type AppInstallSourceKind = "bundle" | "directory" | "registry";

export type AppRegistryInstalledVersion = {
  version: string;
  installDirectory: string;
  sourceKind: AppInstallSourceKind;
  sourceRef: string;
  installedAt: string;
  distributionMode?: AppDistributionMode;
  permissions: AppPermissions;
  registryUrl?: string;
  bundleUrl?: string;
  sha256?: string;
  target?: AppArtifactTarget;
  publisher?: AppPublisher;
  manifestSchemaVersion: 1 | 2;
  components?: AppResolvedComponent[];
  primaryPanelId?: string;
  security?: AppPlatformSecuritySummary;
  dataSchemaVersion: number;
  contentSha256?: string;
};

export type AppRegistryAppRecord = {
  appId: string;
  name: string;
  description?: string;
  publisher?: AppPublisher;
  activeVersion: string;
  enabled: boolean;
  dataDirectory: string;
  defaultInstance: AppInstanceRecord;
  installedVersions: Record<string, AppRegistryInstalledVersion>;
  grants: AppDocumentGrantMap;
  secretBindings: AppSecretBindingMap;
};

export type AppRegistry = {
  schemaVersion: 1;
  apps: Record<string, AppRegistryAppRecord>;
  suppressedBuiltIns: Record<string, {
    suppressedAt: string;
  }>;
};
