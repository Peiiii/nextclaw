export type DistributionArtifactKind =
  | 'npm_runtime_bundle'
  | 'desktop_installer'
  | 'desktop_portable'
  | 'desktop_runtime_bundle'
  | 'update_metadata'
  | 'other';

export type AdminDistributionAssetListQuery = {
  page: number;
  pageSize: 10 | 20;
  query: string;
  artifactKind: DistributionArtifactKind | null;
  platform: string | null;
  sortBy: AdminDistributionAssetSortBy;
  sortDirection: AdminDistributionSortDirection;
};

export type AdminDistributionAssetSortBy =
  | 'default'
  | 'asset_name'
  | 'artifact_kind'
  | 'platform'
  | 'download_count'
  | 'today_downloads'
  | 'yesterday_downloads';

export type AdminDistributionSortDirection = 'asc' | 'desc';

export type AdminDistributionAdoptionOverview = {
  timezone: 'Asia/Shanghai';
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
    source: 'github_release' | 'npm_registry';
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
  }>;
  assets: {
    items: Array<{
      source: 'github_release';
      assetKey: string;
      releaseTag: string | null;
      assetName: string;
      artifactKind: DistributionArtifactKind;
      platform: string | null;
      architecture: string | null;
      downloadCount: number;
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
};
