import type { AppDistributionMode } from "#app-runtime/types/app-bundle.types.js";
import type {
  AppArtifactTarget,
  AppManifest,
  AppPermissions,
} from "#app-runtime/types/app-manifest.types.js";
import type { AppPublisher } from "#app-runtime/types/app-remote-registry.types.js";

export const DEFAULT_APP_MARKETPLACE_API_BASE =
  "https://apps-registry.nextclaw.io";

export type AppMarketplaceVisuals = {
  cover: string;
  accentColor: string;
};

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
  visuals?: AppMarketplaceVisuals;
};

export type AppPublishFile = {
  path: string;
  contentBase64: string;
};

export type AppPublishArtifact = {
  target: AppArtifactTarget;
  bundleBase64: string;
  bundleSha256: string;
  sizeBytes: number;
};

type AppPublishPayloadBase = {
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
  visuals?: AppMarketplaceVisuals;
  distributionMode: AppDistributionMode;
  manifest: AppManifest;
  permissions: AppPermissions;
  files: AppPublishFile[];
};

export type AppPublishPayload = AppPublishPayloadBase & (
  | {
      bundleBase64: string;
      bundleSha256: string;
      artifacts?: never;
    }
  | {
      bundleBase64?: never;
      bundleSha256?: never;
      artifacts: AppPublishArtifact[];
    }
);

export type AppPublishResult = {
  created: boolean;
  item: {
    slug: string;
    appId: string;
    ownerScope: string;
    appName: string;
    publishStatus: "pending" | "published";
    name: string;
    latestVersion: string;
    webUrl?: string;
    install: {
      kind: "registry";
      spec: string;
      registry: string;
    };
  };
  distribution: {
    path?: string;
    sha256?: string;
    mode: AppDistributionMode;
    artifacts?: Array<{
      target: AppArtifactTarget;
      path?: string;
      sha256: string;
      sizeBytes: number;
    }>;
  };
  fileCount: number;
};
