import type { AppPermissions, AppResolvedComponent } from "#app-runtime/types/app-manifest.types.js";
import type { AppDocumentGrantMap } from "#app-runtime/types/app-permissions.types.js";
import type { AppDistributionMode } from "#app-runtime/types/app-bundle.types.js";
import type { AppPublisher } from "#app-runtime/types/app-remote-registry.types.js";

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
  publisher?: AppPublisher;
  manifestSchemaVersion: 1 | 2;
  components?: AppResolvedComponent[];
  primaryPanelId?: string;
};

export type AppRegistryAppRecord = {
  appId: string;
  name: string;
  description?: string;
  activeVersion: string;
  enabled: boolean;
  dataDirectory: string;
  installedVersions: Record<string, AppRegistryInstalledVersion>;
  grants: AppDocumentGrantMap;
};

export type AppRegistry = {
  schemaVersion: 1;
  apps: Record<string, AppRegistryAppRecord>;
};
