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

export type AppItemSummary = {
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

export type AppItemDetail = AppItemSummary & {
  description?: string;
  descriptionI18n?: Record<string, string>;
  sourceRepo?: string;
  homepage?: string;
  manifest: {
    id: string;
    version: string;
  };
  permissions: {
    documentAccess?: Array<{
      id: string;
      mode: string;
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
  publishedAt: string;
  versions: Array<{
    version: string;
    publishedAt: string;
    updatedAt: string;
    bundleSha256: string;
    downloadPath: string;
  }>;
};

export type AppListResult = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query?: string;
  tag?: string;
  items: AppItemSummary[];
};

export type AppFilesResult = {
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
