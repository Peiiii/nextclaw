import type { AppManifest, AppPermissions } from "../manifest/app-manifest.types.js";
import type { AppPublisher } from "../registry/app-remote-registry.types.js";

export const DEFAULT_APP_MARKETPLACE_API_BASE = "https://marketplace-api.nextclaw.io";

export type AppMarketplaceMetadata = {
  slug: string;
  summary: string;
  summaryI18n: Record<string, string>;
  description?: string;
  descriptionI18n?: Record<string, string>;
  author: string;
  tags: string[];
  sourceRepo?: string;
  homepage?: string;
  featured?: boolean;
  publisher?: AppPublisher;
};

export type AppPublishFile = {
  path: string;
  contentBase64: string;
};

export type AppPublishPayload = {
  slug: string;
  appId: string;
  name: string;
  version: string;
  summary: string;
  summaryI18n: Record<string, string>;
  description?: string;
  descriptionI18n?: Record<string, string>;
  author: string;
  tags: string[];
  sourceRepo?: string;
  homepage?: string;
  featured: boolean;
  publisher: AppPublisher;
  manifest: AppManifest;
  permissions: AppPermissions;
  bundleBase64: string;
  bundleSha256: string;
  files: AppPublishFile[];
};

export type AppPublishResult = {
  created: boolean;
  item: {
    slug: string;
    appId: string;
    name: string;
    latestVersion: string;
    install: {
      kind: "registry";
      spec: string;
      command: string;
      registry: string;
    };
  };
  bundle: {
    path: string;
    sha256: string;
  };
  fileCount: number;
};
