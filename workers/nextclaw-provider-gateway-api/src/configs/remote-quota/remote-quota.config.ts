export const REMOTE_QUOTA_WINDOW_MS = 60_000;
export const REMOTE_QUOTA_DAY_MS = 24 * 60 * 60 * 1_000;
export const REMOTE_QUOTA_CONNECTION_RETRY_AFTER_SECONDS = 5;
export const REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS = 1_000;
export const REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS = 50;

export const DEFAULT_REMOTE_QUOTA_SESSION_REQUESTS_PER_MINUTE = 180;
export const DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS = 10_000;
export const DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET = 100_000;
export const DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET = 100_000;
export const DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT = 20;
export const DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS = 20_000;
export const DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS = 20_000;
export const DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE = 10;

export type RemoteQuotaOperationCost = {
  workerRequestUnits: number;
  durableObjectMilliUnits: number;
};

export const REMOTE_RUNTIME_REQUEST_COST: RemoteQuotaOperationCost = {
  workerRequestUnits: 1,
  durableObjectMilliUnits: REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS
};

export const REMOTE_PROXY_REQUEST_COST: RemoteQuotaOperationCost = {
  workerRequestUnits: 1,
  durableObjectMilliUnits: REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS * 2
};

export const REMOTE_BROWSER_CONNECT_COST: RemoteQuotaOperationCost = {
  workerRequestUnits: 1,
  durableObjectMilliUnits: REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS * 2
};

export type RemoteQuotaConfig = {
  sessionRequestsPerMinute: number;
  instanceConnections: number;
  platformDailyWorkerRequestBudget: number;
  platformDailyDoRequestBudgetMilli: number;
  platformDailyReservePercent: number;
  userDailyWorkerRequestUnits: number;
  userDailyDoRequestBudgetMilli: number;
  wsMessageLeaseSize: number;
};

export type RemoteQuotaTicket = {
  ticket: string;
  clientId: string;
  sessionId: string;
  instanceId: string;
  connectedAtMs: number;
};

export type RemoteQuotaWindow = {
  windowStartedAtMs: number;
  count: number;
};

export type RemoteQuotaDailyUsage = {
  dayKey: string;
  workerRequestUnits: number;
  durableObjectMilliUnits: number;
};

export type RemoteQuotaSessionState = {
  requestWindow: RemoteQuotaWindow;
};

export type RemoteQuotaUserState = {
  browserConnections: Record<string, RemoteQuotaTicket>;
  dailyUsage: RemoteQuotaDailyUsage;
  sessions: Record<string, RemoteQuotaSessionState>;
};

export type RemoteQuotaState = {
  platformDailyUsage: RemoteQuotaDailyUsage;
  users: Record<string, RemoteQuotaUserState>;
};

export type RemoteQuotaError = {
  code:
    | "REMOTE_SESSION_RATE_LIMITED"
    | "REMOTE_INSTANCE_CONNECTION_LIMIT"
    | "REMOTE_PLATFORM_WORKER_DAILY_BUDGET_EXCEEDED"
    | "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED"
    | "REMOTE_USER_DAILY_WORKER_BUDGET_EXCEEDED"
    | "REMOTE_USER_DAILY_DO_BUDGET_EXCEEDED"
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

export type RequestWindowUsage = {
  sessionWindow: RemoteQuotaWindow;
};

export type RemoteQuotaBudgets = {
  platformWorkerBudget: number;
  platformDoBudgetMilli: number;
  userWorkerBudget: number;
  userDoBudgetMilli: number;
};

export type RemoteQuotaUsageSummary = {
  limit: number;
  used: number;
  remaining: number;
};

export type RemoteQuotaPlatformUsageSummary = {
  configuredLimit: number;
  enforcedLimit: number;
  used: number;
  remaining: number;
};

export type RemoteQuotaUserSummary = {
  dayKey: string;
  resetsAt: string;
  sessionRequestsPerMinute: number;
  instanceConnectionsPerInstance: number;
  activeBrowserConnections: number;
  workerRequests: RemoteQuotaUsageSummary;
  durableObjectRequests: RemoteQuotaUsageSummary;
};

export type RemoteQuotaPlatformSummary = {
  dayKey: string;
  resetsAt: string;
  reservePercent: number;
  sessionRequestsPerMinute: number;
  instanceConnectionsPerInstance: number;
  defaultUserWorkerBudget: number;
  defaultUserDoBudget: number;
  workerRequests: RemoteQuotaPlatformUsageSummary;
  durableObjectRequests: RemoteQuotaPlatformUsageSummary;
};
