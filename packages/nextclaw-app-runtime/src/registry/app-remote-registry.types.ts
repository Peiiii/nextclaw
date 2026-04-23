import type { AppPermissions } from "../manifest/app-manifest.types.js";
import type { AppDistributionMode } from "../bundle/app-bundle.types.js";

export const DEFAULT_APP_REGISTRY_URL =
  "https://apps-registry.nextclaw.io/api/v1/apps/registry/";

export type AppPublisher = {
  id: string;
  name: string;
  url?: string;
};

export type AppRegistryConfig = {
  schemaVersion: 1;
  registry: {
    url: string;
  };
};

export type AppRegistryConfigSnapshot = {
  defaultUrl: string;
  currentUrl: string;
  source: "default" | "config" | "env";
};

export type AppRemoteRegistryVersion = {
  name: string;
  version: string;
  description?: string;
  publisher?: AppPublisher;
  permissions?: AppPermissions;
  dist: {
    kind?: AppDistributionMode;
    artifact?: string;
    bundle: string;
    source?: string;
    sha256: string;
  };
};

export type AppRemoteRegistryDocument = {
  name: string;
  description?: string;
  "dist-tags": {
    latest: string;
  };
  versions: Record<string, AppRemoteRegistryVersion>;
};

export type AppRemoteRegistryResolution = {
  registryUrl: string;
  metadataUrl: string;
  appId: string;
  version: string;
  description?: string;
  publisher?: AppPublisher;
  permissions?: AppPermissions;
  distributionMode: AppDistributionMode;
  bundleUrl: string;
  sha256: string;
};
