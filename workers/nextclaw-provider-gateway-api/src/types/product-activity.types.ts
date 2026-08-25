export type ProductActivityAudience = "external" | "internal" | "qa";
export type ProductActivityEnvironment = "production" | "development" | "test";
export type ProductActivityReleaseChannel = "stable" | "beta" | "nightly" | "development";
export type ProductActivityPlatform = "macos" | "windows" | "linux" | "other";
export type ProductActivityMetric = "active" | "successful";
export type ProductActivityPeriodKind = "day" | "week" | "month";

export type ProductActivityInput = {
  schemaVersion: 2;
  receiptId: string;
  metric: ProductActivityMetric;
  periodKind: ProductActivityPeriodKind;
  periodStart: string;
  occurredAt: string;
  audience: ProductActivityAudience;
  environment: ProductActivityEnvironment;
  releaseChannel: ProductActivityReleaseChannel;
  platform: ProductActivityPlatform;
  appVersion: string;
};

export type ProductActivityIngestRecord = Omit<ProductActivityInput, "schemaVersion" | "occurredAt"> & {
  receivedAt: string;
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
  };
  trend: Array<{
    date: string;
    active: number;
    successful: number;
  }>;
};
