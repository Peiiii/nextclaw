export const REMOTE_QUOTA_COST_MODEL_VERSION = 2;
export const REMOTE_QUOTA_COST_MODEL_VERIFIED_AT = "2026-07-18";
export const REMOTE_QUOTA_DAY_MS = 24 * 60 * 60 * 1_000;
export const REMOTE_QUOTA_RECENT_BUCKET_MS = 5 * 60 * 1_000;
export const REMOTE_QUOTA_RECENT_BUCKET_COUNT = 12;
export const REMOTE_QUOTA_CONNECTION_RETRY_AFTER_SECONDS = 5;
export const REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS = 1_000;
export const REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS = 50;

export const DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS = 10_000;
export const DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET = 100_000;
export const DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET = 100_000;
export const DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT = 20;
export const DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS = 20_000;
export const DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS = 20_000;
export const DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE = 10;
export const DEFAULT_REMOTE_QUOTA_WS_USAGE_REPORT_SIZE = 100;

export type RemoteQuotaOperationCost = {
  workerRequestUnits: number;
  durableObjectMilliUnits: number;
};

export const REMOTE_QUOTA_ATTEMPT_COST: RemoteQuotaOperationCost = {
  workerRequestUnits: 1,
  durableObjectMilliUnits: REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS
};

export const REMOTE_RUNTIME_REQUEST_COST: RemoteQuotaOperationCost = REMOTE_QUOTA_ATTEMPT_COST;

export const REMOTE_PROXY_REQUEST_COST: RemoteQuotaOperationCost = {
  workerRequestUnits: 1,
  durableObjectMilliUnits: REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS * 2
};

export const REMOTE_BROWSER_CONNECT_COST: RemoteQuotaOperationCost = REMOTE_PROXY_REQUEST_COST;
export const REMOTE_CONNECTOR_CONNECT_COST: RemoteQuotaOperationCost = REMOTE_PROXY_REQUEST_COST;
export const REMOTE_QUOTA_INTERNAL_REQUEST_COST: RemoteQuotaOperationCost = {
  workerRequestUnits: 0,
  durableObjectMilliUnits: REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS
};

export type RemoteQuotaConfig = {
  planProfile: "workers-free";
  instanceConnections: number;
  platformDailyWorkerRequestBudget: number;
  platformDailyDoRequestBudgetMilli: number;
  platformDailyReservePercent: number;
  userDailyWorkerRequestUnits: number;
  userDailyDoRequestBudgetMilli: number;
  wsMessageLeaseSize: number;
  wsUsageReportSize: number;
};

export type RemoteQuotaTicket = {
  ticket: string;
  clientId: string;
  sessionId: string;
  instanceId: string;
  connectedAtMs: number;
  reservedMessages: number;
};

export type RemoteQuotaDailyUsage = RemoteQuotaOperationCost & {
  dayKey: string;
};

export type RemoteQuotaUsageBucket = RemoteQuotaOperationCost & {
  startedAtMs: number;
};

export type RemoteQuotaUserState = {
  browserConnections: Record<string, RemoteQuotaTicket>;
  dailyUsage: RemoteQuotaDailyUsage;
  dailyReserved: RemoteQuotaDailyUsage;
  recentUsage: RemoteQuotaUsageBucket[];
};

export type RemoteQuotaState = {
  costModelVersion: typeof REMOTE_QUOTA_COST_MODEL_VERSION;
  initializedAtMs: number;
  platformDailyUsage: RemoteQuotaDailyUsage;
  platformDailyReserved: RemoteQuotaDailyUsage;
  platformRecentUsage: RemoteQuotaUsageBucket[];
  users: Record<string, RemoteQuotaUserState>;
};

export type RemoteQuotaError = {
  code:
    | "REMOTE_INSTANCE_CONNECTION_LIMIT"
    | "REMOTE_PLATFORM_WORKER_DAILY_BUDGET_EXCEEDED"
    | "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED"
    | "REMOTE_USER_DAILY_WORKER_BUDGET_EXCEEDED"
    | "REMOTE_USER_DAILY_DO_BUDGET_EXCEEDED"
    | "REMOTE_QUOTA_CONNECTION_NOT_FOUND"
    | "REMOTE_QUOTA_GUARD_UNAVAILABLE";
  message: string;
  retryAfterSeconds: number;
};

export type RemoteQuotaSuccess<T> = {
  ok: true;
  data: T;
  state: RemoteQuotaState;
};

export type RemoteQuotaFailure = {
  ok: false;
  error: RemoteQuotaError;
  state: RemoteQuotaState;
};

export type RemoteQuotaDecision<T> = RemoteQuotaSuccess<T> | RemoteQuotaFailure;

export type ConnectionUsage = {
  instanceCount: number;
};

export type RemoteQuotaBudgets = {
  platformWorkerBudget: number;
  platformDoBudgetMilli: number;
  userWorkerBudget: number;
  userDoBudgetMilli: number;
};

export type RemoteQuotaResourceSummary = {
  limit: number;
  actualUsed: number;
  reserved: number;
  remaining: number;
};

export type RemoteQuotaPlatformResourceSummary = RemoteQuotaResourceSummary & {
  configuredLimit: number;
};

export type RemoteQuotaRecentUsageSummary = {
  workerRequests: number;
  durableObjectRequests: number;
};

export type RemoteQuotaRecentBucketSummary = RemoteQuotaRecentUsageSummary & {
  startedAt: string;
};

export type RemoteQuotaSummaryMetadata = {
  version: number;
  verifiedAt: string;
  observedThrough: string;
  partialDay: boolean;
  stale: boolean;
};

export type RemoteQuotaDaySummary<TResource> = {
  startsAt: string;
  resetsAt: string;
  status: "normal" | "near_limit" | "exhausted";
  utilization: number;
  limitingResource: "worker_requests" | "durable_object_requests";
  workerRequests: TResource;
  durableObjectRequests: TResource;
};

export type RemoteQuotaRecentSummary = {
  bucketSeconds: number;
  last30Minutes: RemoteQuotaRecentUsageSummary;
  lastHour: RemoteQuotaRecentUsageSummary;
  buckets: RemoteQuotaRecentBucketSummary[];
};

export type RemoteQuotaProtectionSummary = {
  runawayGuard: "shadow";
  activeUntil: null;
};

export type RemoteQuotaUserSummary = {
  costModel: RemoteQuotaSummaryMetadata;
  day: RemoteQuotaDaySummary<RemoteQuotaResourceSummary>;
  recent: RemoteQuotaRecentSummary;
  protection: RemoteQuotaProtectionSummary;
  activeBrowserConnections: number;
};

export type RemoteQuotaPlatformSummary = {
  costModel: RemoteQuotaSummaryMetadata;
  day: RemoteQuotaDaySummary<RemoteQuotaPlatformResourceSummary>;
  recent: RemoteQuotaRecentSummary;
  protection: RemoteQuotaProtectionSummary;
  reservePercent: number;
  defaultUserWorkerBudget: number;
  defaultUserDoBudget: number;
  instanceConnectionsPerInstance: number;
  plan: {
    id: "workers-free";
    resetsAt: "00:00Z";
    workerRequestsPerDay: number;
    durableObjectRequestsPerDay: number;
  };
  calibration: {
    status: "bootstrap_capacity_contract";
    safetyReservePercent: number;
    supportedHeavyUsers: number;
    basis: "official_free_limit_minus_shared_platform_reserve";
  };
};
