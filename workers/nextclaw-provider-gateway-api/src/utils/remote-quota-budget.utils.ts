import type {
  RemoteQuotaBudgets,
  RemoteQuotaConfig,
  RemoteQuotaDailyUsage,
  RemoteQuotaError,
  RemoteQuotaOperationCost,
} from "@/configs/remote-quota.config.js";
import { REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS } from "@/configs/remote-quota.config.js";
import { secondsUntilDayReset } from "./remote-quota-state.utils.js";

export function evaluateDailyBudget(
  config: RemoteQuotaConfig,
  usage: {
    platformActual: RemoteQuotaDailyUsage;
    platformReserved: RemoteQuotaDailyUsage;
    userActual: RemoteQuotaDailyUsage;
    userReserved: RemoteQuotaDailyUsage;
  },
  nowMs: number,
  cost: RemoteQuotaOperationCost
): RemoteQuotaError | null {
  const budgets = readDailyBudgets(config);
  const platformWorkerUsed = total(usage.platformActual.workerRequestUnits, usage.platformReserved.workerRequestUnits);
  const platformDoUsed = total(usage.platformActual.durableObjectMilliUnits, usage.platformReserved.durableObjectMilliUnits);
  const userWorkerUsed = total(usage.userActual.workerRequestUnits, usage.userReserved.workerRequestUnits);
  const userDoUsed = total(usage.userActual.durableObjectMilliUnits, usage.userReserved.durableObjectMilliUnits);

  if (platformWorkerUsed + cost.workerRequestUnits > budgets.platformWorkerBudget) {
    return buildBudgetError(
      "REMOTE_PLATFORM_WORKER_DAILY_BUDGET_EXCEEDED",
      "Remote access is temporarily degraded because the platform Worker daily request budget is exhausted.",
      nowMs
    );
  }
  if (platformDoUsed + cost.durableObjectMilliUnits > budgets.platformDoBudgetMilli) {
    return buildBudgetError(
      "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED",
      "Remote access is temporarily degraded because the platform Durable Object daily request budget is exhausted.",
      nowMs
    );
  }
  if (userWorkerUsed + cost.workerRequestUnits > budgets.userWorkerBudget) {
    return buildBudgetError(
      "REMOTE_USER_DAILY_WORKER_BUDGET_EXCEEDED",
      "Remote access is temporarily degraded because today's remote Worker request allowance is exhausted.",
      nowMs
    );
  }
  if (userDoUsed + cost.durableObjectMilliUnits > budgets.userDoBudgetMilli) {
    return buildBudgetError(
      "REMOTE_USER_DAILY_DO_BUDGET_EXCEEDED",
      "Remote access is temporarily degraded because today's remote Durable Object request allowance is exhausted.",
      nowMs
    );
  }
  return null;
}

export function computeMaxGrantableWsMessages(
  config: RemoteQuotaConfig,
  usage: {
    platformActual: RemoteQuotaDailyUsage;
    platformReserved: RemoteQuotaDailyUsage;
    userActual: RemoteQuotaDailyUsage;
    userReserved: RemoteQuotaDailyUsage;
  }
): number {
  const budgets = readDailyBudgets(config);
  const platformRemaining = budgets.platformDoBudgetMilli
    - usage.platformActual.durableObjectMilliUnits
    - usage.platformReserved.durableObjectMilliUnits;
  const userRemaining = budgets.userDoBudgetMilli
    - usage.userActual.durableObjectMilliUnits
    - usage.userReserved.durableObjectMilliUnits;
  return Math.max(0, Math.floor(
    Math.min(platformRemaining, userRemaining) / REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS
  ));
}

export function readDailyBudgets(config: RemoteQuotaConfig): RemoteQuotaBudgets {
  const effectivePercent = Math.max(1, 100 - config.platformDailyReservePercent);
  return {
    platformWorkerBudget: Math.floor(config.platformDailyWorkerRequestBudget * effectivePercent / 100),
    platformDoBudgetMilli: Math.floor(config.platformDailyDoRequestBudgetMilli * effectivePercent / 100),
    userWorkerBudget: config.userDailyWorkerRequestUnits,
    userDoBudgetMilli: config.userDailyDoRequestBudgetMilli
  };
}

function total(actual: number, reserved: number): number {
  return actual + reserved;
}

function buildBudgetError(
  code: RemoteQuotaError["code"],
  message: string,
  nowMs: number
): RemoteQuotaError {
  return {
    code,
    message,
    retryAfterSeconds: secondsUntilDayReset(nowMs)
  };
}
