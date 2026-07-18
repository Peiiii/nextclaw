import {
  REMOTE_QUOTA_COST_MODEL_VERIFIED_AT,
  REMOTE_QUOTA_COST_MODEL_VERSION,
  REMOTE_QUOTA_RECENT_BUCKET_MS,
  type RemoteQuotaConfig,
  type RemoteQuotaDailyUsage,
  type RemoteQuotaDaySummary,
  type RemoteQuotaPlatformResourceSummary,
  type RemoteQuotaPlatformSummary,
  type RemoteQuotaRecentSummary,
  type RemoteQuotaResourceSummary,
  type RemoteQuotaState,
  type RemoteQuotaUsageBucket,
  type RemoteQuotaUserSummary,
} from "@/configs/remote-quota.config.js";
import { readDailyBudgets } from "./remote-quota-budget.utils.js";
import { getUserState, normalizeRemoteQuotaState, startOfUtcDayMs } from "./remote-quota-state.utils.js";

export function readRemoteQuotaUserSummary(
  state: RemoteQuotaState | null | undefined,
  config: RemoteQuotaConfig,
  userId: string,
  nowMs: number
): RemoteQuotaUserSummary {
  const normalizedState = normalizeRemoteQuotaState(state, nowMs);
  const userState = getUserState(normalizedState, userId, nowMs);
  const budgets = readDailyBudgets(config);
  return {
    costModel: buildMetadata(normalizedState, nowMs),
    day: buildDaySummary({
      nowMs,
      workerRequests: toResourceSummary(
        budgets.userWorkerBudget,
        userState.dailyUsage.workerRequestUnits,
        userState.dailyReserved.workerRequestUnits
      ),
      durableObjectRequests: toResourceSummary(
        toDoRequestUnits(budgets.userDoBudgetMilli),
        toDoRequestUnits(userState.dailyUsage.durableObjectMilliUnits),
        toDoRequestUnits(userState.dailyReserved.durableObjectMilliUnits)
      )
    }),
    recent: buildRecentSummary(userState.recentUsage, nowMs),
    protection: {
      runawayGuard: "shadow",
      activeUntil: null
    },
    activeBrowserConnections: Object.keys(userState.browserConnections).length
  };
}

export function readRemoteQuotaPlatformSummary(
  state: RemoteQuotaState | null | undefined,
  config: RemoteQuotaConfig,
  nowMs: number
): RemoteQuotaPlatformSummary {
  const normalizedState = normalizeRemoteQuotaState(state, nowMs);
  const budgets = readDailyBudgets(config);
  return {
    costModel: buildMetadata(normalizedState, nowMs),
    day: buildDaySummary({
      nowMs,
      workerRequests: toPlatformResourceSummary(
        config.platformDailyWorkerRequestBudget,
        budgets.platformWorkerBudget,
        normalizedState.platformDailyUsage.workerRequestUnits,
        normalizedState.platformDailyReserved.workerRequestUnits
      ),
      durableObjectRequests: toPlatformResourceSummary(
        toDoRequestUnits(config.platformDailyDoRequestBudgetMilli),
        toDoRequestUnits(budgets.platformDoBudgetMilli),
        toDoRequestUnits(normalizedState.platformDailyUsage.durableObjectMilliUnits),
        toDoRequestUnits(normalizedState.platformDailyReserved.durableObjectMilliUnits)
      )
    }),
    recent: buildRecentSummary(normalizedState.platformRecentUsage, nowMs),
    protection: {
      runawayGuard: "shadow",
      activeUntil: null
    },
    reservePercent: config.platformDailyReservePercent,
    defaultUserWorkerBudget: config.userDailyWorkerRequestUnits,
    defaultUserDoBudget: toDoRequestUnits(config.userDailyDoRequestBudgetMilli),
    instanceConnectionsPerInstance: config.instanceConnections,
    plan: {
      id: config.planProfile,
      resetsAt: "00:00Z",
      workerRequestsPerDay: config.platformDailyWorkerRequestBudget,
      durableObjectRequestsPerDay: toDoRequestUnits(config.platformDailyDoRequestBudgetMilli)
    },
    calibration: {
      status: "bootstrap_capacity_contract",
      safetyReservePercent: config.platformDailyReservePercent,
      supportedHeavyUsers: Math.max(1, Math.min(
        Math.floor(budgets.platformWorkerBudget / config.userDailyWorkerRequestUnits),
        Math.floor(budgets.platformDoBudgetMilli / config.userDailyDoRequestBudgetMilli)
      )),
      basis: "official_free_limit_minus_shared_platform_reserve"
    }
  };
}

function buildDaySummary<TResource extends RemoteQuotaResourceSummary>(params: {
  nowMs: number;
  workerRequests: TResource;
  durableObjectRequests: TResource;
}): RemoteQuotaDaySummary<TResource> {
  const { durableObjectRequests, nowMs, workerRequests } = params;
  const workerUtilization = utilization(workerRequests);
  const doUtilization = utilization(durableObjectRequests);
  const dayUtilization = Math.max(workerUtilization, doUtilization);
  return {
    startsAt: new Date(startOfUtcDayMs(nowMs)).toISOString(),
    resetsAt: buildDayResetIso(nowMs),
    status: dayUtilization >= 1 ? "exhausted" : dayUtilization >= 0.8 ? "near_limit" : "normal",
    utilization: round(dayUtilization),
    limitingResource: workerUtilization >= doUtilization
      ? "worker_requests"
      : "durable_object_requests",
    workerRequests,
    durableObjectRequests
  };
}

function buildRecentSummary(usage: RemoteQuotaUsageBucket[], nowMs: number): RemoteQuotaRecentSummary {
  return {
    bucketSeconds: REMOTE_QUOTA_RECENT_BUCKET_MS / 1_000,
    last30Minutes: sumRecentUsage(usage, nowMs - 30 * 60 * 1_000),
    lastHour: sumRecentUsage(usage, nowMs - 60 * 60 * 1_000),
    buckets: usage.map((bucket) => ({
      startedAt: new Date(bucket.startedAtMs).toISOString(),
      workerRequests: bucket.workerRequestUnits,
      durableObjectRequests: toDoRequestUnits(bucket.durableObjectMilliUnits)
    }))
  };
}

function sumRecentUsage(usage: RemoteQuotaUsageBucket[], sinceMs: number) {
  const total = usage
    .filter((bucket) => bucket.startedAtMs >= sinceMs)
    .reduce<RemoteQuotaDailyUsage>((sum, bucket) => ({
      ...sum,
      workerRequestUnits: sum.workerRequestUnits + bucket.workerRequestUnits,
      durableObjectMilliUnits: sum.durableObjectMilliUnits + bucket.durableObjectMilliUnits
    }), {
      dayKey: "recent",
      workerRequestUnits: 0,
      durableObjectMilliUnits: 0
    });
  return {
    workerRequests: total.workerRequestUnits,
    durableObjectRequests: toDoRequestUnits(total.durableObjectMilliUnits)
  };
}

function toResourceSummary(limit: number, actualUsed: number, reserved: number): RemoteQuotaResourceSummary {
  return {
    limit,
    actualUsed,
    reserved,
    remaining: Math.max(0, round(limit - actualUsed - reserved))
  };
}

function toPlatformResourceSummary(
  configuredLimit: number,
  enforcedLimit: number,
  actualUsed: number,
  reserved: number
): RemoteQuotaPlatformResourceSummary {
  return {
    ...toResourceSummary(enforcedLimit, actualUsed, reserved),
    configuredLimit
  };
}

function buildMetadata(state: RemoteQuotaState, nowMs: number) {
  return {
    version: REMOTE_QUOTA_COST_MODEL_VERSION,
    verifiedAt: REMOTE_QUOTA_COST_MODEL_VERIFIED_AT,
    observedThrough: new Date(nowMs).toISOString(),
    partialDay: state.initializedAtMs > startOfUtcDayMs(nowMs),
    stale: false
  };
}

function utilization(resource: RemoteQuotaResourceSummary): number {
  if (resource.limit <= 0) {
    return 1;
  }
  return (resource.actualUsed + resource.reserved) / resource.limit;
}

function toDoRequestUnits(value: number): number {
  return round(value / 1_000);
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function buildDayResetIso(nowMs: number): string {
  return new Date(startOfUtcDayMs(nowMs) + 24 * 60 * 60 * 1_000).toISOString();
}
