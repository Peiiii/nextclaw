export type DistributionSource = "github_release" | "npm_registry";

export type DistributionArtifactKind =
  | "npm_package"
  | "npm_runtime_bundle"
  | "desktop_installer"
  | "desktop_portable"
  | "desktop_runtime_bundle"
  | "update_metadata"
  | "other";

export type DistributionAssetRecord = {
  source: DistributionSource;
  assetKey: string;
  releaseTag: string | null;
  assetName: string;
  artifactKind: DistributionArtifactKind;
  platform: string | null;
  architecture: string | null;
  downloadCount: number;
};

export type DistributionAssetRow = {
  source: DistributionSource;
  asset_key: string;
  release_tag: string | null;
  asset_name: string;
  artifact_kind: DistributionArtifactKind;
  platform: string | null;
  architecture: string | null;
  latest_download_count: number;
  first_observed_at: string;
  last_synced_at: string;
};

export type DistributionAssetListQuery = {
  page: number;
  pageSize: 10 | 20;
  query: string;
  artifactKind: DistributionArtifactKind | null;
  platform: string | null;
};

export type DistributionAssetList = {
  items: Array<DistributionAssetRecord & {
    firstObservedAt: string;
    lastSyncedAt: string;
    todayDownloads: number | null;
    yesterdayDownloads: number | null;
  }>;
  page: number;
  pageSize: 10 | 20;
  total: number;
  totalPages: number;
  artifactKinds: DistributionArtifactKind[];
  platforms: string[];
};

export type DistributionDailyRow = {
  source: DistributionSource;
  asset_key: string;
  business_date: string;
  download_count: number;
};

export type DistributionSyncStateRow = {
  source: DistributionSource;
  last_attempt_at: string;
  last_success_at: string | null;
  last_error: string | null;
};

export type DistributionAdoptionOverview = {
  timezone: "Asia/Shanghai";
  fetchedAt: string | null;
  github: {
    totalDownloads: number;
    todayDownloads: number | null;
    yesterdayDownloads: number | null;
    firstDailySnapshotDate: string | null;
  };
  npm: {
    latestDate: string | null;
    latestDownloads: number | null;
    trend: Array<{ date: string; downloads: number }>;
  };
  sources: Array<{
    source: DistributionSource;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
  }>;
  assets: DistributionAssetList;
};
