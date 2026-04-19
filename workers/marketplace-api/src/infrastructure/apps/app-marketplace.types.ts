export const OFFICIAL_APPS_WEB_BASE_URL = "https://apps.nextclaw.io";
export const OFFICIAL_APPS_REGISTRY_BASE_URL = "https://apps-registry.nextclaw.io";
export const OFFICIAL_APPS_REGISTRY_METADATA_URL =
  `${OFFICIAL_APPS_REGISTRY_BASE_URL}/api/v1/apps/registry/`;

export type AppPublisher = {
  id: string;
  name: string;
  url?: string;
};

export type AppInstallSpec = {
  kind: "registry";
  spec: string;
  command: string;
  registry: string;
};

export type AppPermissions = {
  documentAccess?: Array<{
    id: string;
    mode: "read" | "readWrite";
    description?: string;
  }>;
  allowedDomains?: string[];
  storage?: {
    namespace?: string;
  };
  capabilities?: {
    hostBridge?: boolean;
  };
};

export type MarketplaceAppManifest = {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description?: string;
  main: {
    kind: "wasm";
    entry: string;
    export: string;
    action: string;
  };
  ui: {
    entry: string;
  };
  icon?: string;
  permissions?: AppPermissions;
};

export type MarketplaceAppFileInput = {
  path: string;
  contentBase64: string;
};

export type MarketplaceAppPublishInput = {
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
  manifest: MarketplaceAppManifest;
  permissions: AppPermissions;
  bundleBase64: string;
  bundleSha256: string;
  files: MarketplaceAppFileInput[];
};

export type MarketplaceAppItemSummary = {
  id: string;
  slug: string;
  appId: string;
  name: string;
  summary: string;
  summaryI18n: Record<string, string>;
  tags: string[];
  author: string;
  updatedAt: string;
  latestVersion: string;
  featured: boolean;
  publisher: AppPublisher;
  install: AppInstallSpec;
  webUrl: string;
};

export type MarketplaceAppItemDetail = MarketplaceAppItemSummary & {
  description?: string;
  descriptionI18n?: Record<string, string>;
  sourceRepo?: string;
  homepage?: string;
  manifest: MarketplaceAppManifest;
  permissions: AppPermissions;
  publishedAt: string;
  versions: Array<{
    version: string;
    publishedAt: string;
    updatedAt: string;
    bundleSha256: string;
    downloadPath: string;
  }>;
};

export type MarketplaceAppListResult = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query?: string;
  tag?: string;
  items: MarketplaceAppItemSummary[];
};

export type MarketplaceAppFilesResult = {
  slug: string;
  appId: string;
  totalFiles: number;
  files: Array<{
    path: string;
    contentType: string;
    sizeBytes: number;
    sha256: string;
    updatedAt: string;
    downloadPath: string;
  }>;
};

export type MarketplaceAppPublishResult = {
  created: boolean;
  item: {
    slug: string;
    appId: string;
    name: string;
    latestVersion: string;
    webUrl: string;
    install: AppInstallSpec;
  };
  fileCount: number;
};

export type MarketplaceAppItemRow = {
  id: string;
  slug: string;
  app_id: string;
  name: string;
  summary: string;
  summary_i18n: string;
  description: string | null;
  description_i18n: string | null;
  tags: string;
  author: string;
  source_repo: string | null;
  homepage: string | null;
  featured: number;
  publisher_id: string;
  publisher_name: string;
  publisher_url: string | null;
  latest_version: string;
  manifest_json: string;
  permissions_json: string;
  published_at: string;
  updated_at: string;
};

export type MarketplaceAppVersionRow = {
  item_id: string;
  version: string;
  manifest_json: string;
  permissions_json: string;
  description: string | null;
  bundle_sha256: string;
  bundle_storage_key: string;
  published_at: string;
  updated_at: string;
};

export type MarketplaceAppFileRow = {
  item_id: string;
  path: string;
  content_type: string;
  sha256: string;
  size_bytes: number;
  storage_key: string;
  updated_at: string;
};
