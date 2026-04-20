import type {
  RemoteQuotaConfig,
  RemoteQuotaPlatformSummary,
  RemoteQuotaState,
  RemoteQuotaUsageSummary,
  RemoteQuotaUserSummary,
} from "@/configs/remote-quota/remote-quota.config.js";
import { readDailyBudgets } from "./remote-quota-budget.utils.js";
import { getUserState, normalizeRemoteQuotaState } from "./remote-quota-state.utils.js";

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
    dayKey: userState.dailyUsage.dayKey,
    resetsAt: buildDayResetIso(nowMs),
    sessionRequestsPerMinute: config.sessionRequestsPerMinute,
    instanceConnectionsPerInstance: config.instanceConnections,
    activeBrowserConnections: Object.keys(userState.browserConnections).length,
    workerRequests: toUsageSummary(
      budgets.userWorkerBudget,
      userState.dailyUsage.workerRequestUnits,
      { scale: "identity" }
    ),
    durableObjectRequests: toUsageSummary(
      config.userDailyDoRequestBudgetMilli,
      userState.dailyUsage.durableObjectMilliUnits,
      { scale: "do_request_units" }
    )
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
    dayKey: normalizedState.platformDailyUsage.dayKey,
    resetsAt: buildDayResetIso(nowMs),
    reservePercent: config.platformDailyReservePercent,
    sessionRequestsPerMinute: config.sessionRequestsPerMinute,
    instanceConnectionsPerInstance: config.instanceConnections,
    defaultUserWorkerBudget: config.userDailyWorkerRequestUnits,
    defaultUserDoBudget: toDoRequestUnits(config.userDailyDoRequestBudgetMilli),
    workerRequests: {
      configuredLimit: config.platformDailyWorkerRequestBudget,
      enforcedLimit: budgets.platformWorkerBudget,
      used: normalizedState.platformDailyUsage.workerRequestUnits,
      remaining: Math.max(0, budgets.platformWorkerBudget - normalizedState.platformDailyUsage.workerRequestUnits)
    },
    durableObjectRequests: {
      configuredLimit: toDoRequestUnits(config.platformDailyDoRequestBudgetMilli),
      enforcedLimit: toDoRequestUnits(budgets.platformDoBudgetMilli),
      used: toDoRequestUnits(normalizedState.platformDailyUsage.durableObjectMilliUnits),
      remaining: toDoRequestUnits(Math.max(0, budgets.platformDoBudgetMilli - normalizedState.platformDailyUsage.durableObjectMilliUnits))
    }
  };
}

function toUsageSummary(
  limit: number,
  used: number,
  options: { scale: "identity" | "do_request_units" }
): RemoteQuotaUsageSummary {
  return {
    limit: scaleValue(limit, options.scale),
    used: scaleValue(used, options.scale),
    remaining: scaleValue(Math.max(0, limit - used), options.scale)
  };
}

function scaleValue(value: number, scale: "identity" | "do_request_units"): number {
  if (scale === "identity") {
    return value;
  }
  return toDoRequestUnits(value);
}

function toDoRequestUnits(value: number): number {
  if (value % 1_000 === 0) {
    return value / 1_000;
  }
  return Number((value / 1_000).toFixed(3));
}

function buildDayResetIso(nowMs: number): string {
  const current = new Date(nowMs);
  return new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() + 1
  )).toISOString();
}
