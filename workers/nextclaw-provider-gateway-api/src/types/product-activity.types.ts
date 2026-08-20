export type ProductActivityAudience = "external" | "internal" | "qa";
export type ProductActivityEnvironment = "production" | "development" | "test";
export type ProductActivityReleaseChannel = "stable" | "beta" | "nightly" | "development";
export type ProductActivityPlatform = "macos" | "windows" | "linux" | "other";
export type ProductActivityEvent = "intent_accepted" | "run_succeeded";
export type ProductActivitySource = "direct" | "channel";

export type ProductActivityInput = {
  schemaVersion: 1;
  installationId: string;
  event: ProductActivityEvent;
  occurredAt: string;
  source: ProductActivitySource;
  audience: ProductActivityAudience;
  environment: ProductActivityEnvironment;
  releaseChannel: ProductActivityReleaseChannel;
  platform: ProductActivityPlatform;
  appVersion: string;
};

export type ProductActivityIngestRecord = {
  installationHash: string;
  linkedUserId: string | null;
  audience: ProductActivityAudience;
  environment: ProductActivityEnvironment;
  releaseChannel: ProductActivityReleaseChannel;
  platform: ProductActivityPlatform;
  appVersion: string;
  activityDate: string;
  event: ProductActivityEvent;
  source: ProductActivitySource;
  nowIso: string;
};

export type ProductActivityOverviewFilter = {
  audience: ProductActivityAudience;
  environment: ProductActivityEnvironment;
  releaseChannel: ProductActivityReleaseChannel;
  trendDays: number;
};

export type ProductActivityMetricRow = {
  dau: number;
  wau: number;
  mau: number;
  successful_dau: number;
  successful_wau: number;
  successful_mau: number;
  wau_anonymous_installations: number;
  wau_identified_users: number;
};

export type ProductActivityTrendRow = {
  activity_date: string;
  active: number;
  successful: number;
};

export type ProductActivityOverview = {
  timezone: "Asia/Shanghai";
  asOfDate: string;
  filters: ProductActivityOverviewFilter;
  metrics: {
    dau: number;
    wau: number;
    mau: number;
    successfulDau: number;
    successfulWau: number;
    successfulMau: number;
    wauAnonymousInstallations: number;
    wauIdentifiedUsers: number;
    wauIdentificationRate: number;
  };
  trend: Array<{
    date: string;
    active: number;
    successful: number;
  }>;
};
