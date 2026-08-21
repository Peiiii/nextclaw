export type DistributionArtifactKind =
  | 'npm_runtime_bundle'
  | 'desktop_installer'
  | 'desktop_portable'
  | 'desktop_runtime_bundle'
  | 'update_metadata'
  | 'other';

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
  assets: Array<{
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
};
