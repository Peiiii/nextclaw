import type {
  RemoteQuotaBudgets,
  RemoteQuotaConfig,
  RemoteQuotaDailyUsage,
  RemoteQuotaError,
  RemoteQuotaOperationCost,
  RemoteQuotaSessionState,
} from "@/configs/remote-quota/remote-quota.config.js";
import { REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS } from "@/configs/remote-quota/remote-quota.config.js";
import { readRequestWindowUsage, secondsUntilDayReset, secondsUntilWindowReset } from "./remote-quota-state.utils.js";

export function createWsLeaseCost(messages: number): RemoteQuotaOperationCost {
  return {
    workerRequestUnits: 0,
    durableObjectMilliUnits: messages * REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS
  };
}

export function evaluateDailyBudget(
  config: RemoteQuotaConfig,
  platformUsage: RemoteQuotaDailyUsage,
  userUsage: RemoteQuotaDailyUsage,
  nowMs: number,
  cost: RemoteQuotaOperationCost
): RemoteQuotaError | null {
  const budgets = readDailyBudgets(config);
  if (platformUsage.workerRequestUnits + cost.workerRequestUnits > budgets.platformWorkerBudget) {
    return buildBudgetError(
      "REMOTE_PLATFORM_WORKER_DAILY_BUDGET_EXCEEDED",
      "Remote access is temporarily degraded because the platform worker daily budget is exhausted.",
      nowMs
    );
  }
  if (platformUsage.durableObjectMilliUnits + cost.durableObjectMilliUnits > budgets.platformDoBudgetMilli) {
    return buildBudgetError(
      "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED",
      "Remote access is temporarily degraded because the platform durable object daily budget is exhausted.",
      nowMs
    );
  }
  if (userUsage.workerRequestUnits + cost.workerRequestUnits > budgets.userWorkerBudget) {
    return buildBudgetError(
      "REMOTE_USER_DAILY_WORKER_BUDGET_EXCEEDED",
      "Remote access is temporarily degraded because this user has exhausted today's worker request budget.",
      nowMs
    );
  }
  if (userUsage.durableObjectMilliUnits + cost.durableObjectMilliUnits > budgets.userDoBudgetMilli) {
    return buildBudgetError(
      "REMOTE_USER_DAILY_DO_BUDGET_EXCEEDED",
      "Remote access is temporarily degraded because this user has exhausted today's durable object budget.",
      nowMs
    );
  }
  return null;
}

export function computeMaxGrantableWsMessages(
  config: RemoteQuotaConfig,
  platformUsage: RemoteQuotaDailyUsage,
  userUsage: RemoteQuotaDailyUsage
): number {
  const budgets = readDailyBudgets(config);
  return Math.min(
    Math.max(0, Math.floor((budgets.platformDoBudgetMilli - platformUsage.durableObjectMilliUnits) / REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS)),
    Math.max(0, Math.floor((budgets.userDoBudgetMilli - userUsage.durableObjectMilliUnits) / REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS))
  );
}

export function resolveWsLeaseBlockingError(
  config: RemoteQuotaConfig,
  platformUsage: RemoteQuotaDailyUsage,
  userUsage: RemoteQuotaDailyUsage,
  sessionState: RemoteQuotaSessionState | undefined,
  nowMs: number
): RemoteQuotaError {
  const usage = readRequestWindowUsage(sessionState, nowMs);
  if (usage.sessionWindow.count >= config.sessionRequestsPerMinute) {
    return buildBudgetError(
      "REMOTE_SESSION_RATE_LIMITED",
      "Remote access is temporarily degraded because this session is sending requests too quickly.",
      nowMs,
      secondsUntilWindowReset(nowMs)
    );
  }
  return evaluateDailyBudget(
    config,
    platformUsage,
    userUsage,
    nowMs,
    createWsLeaseCost(1)
  ) ?? buildBudgetError(
    "REMOTE_PLATFORM_DO_DAILY_BUDGET_EXCEEDED",
    "Remote access is temporarily degraded because the platform durable object daily budget is exhausted.",
    nowMs
  );
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

function buildBudgetError(
  code: RemoteQuotaError["code"],
  message: string,
  nowMs: number,
  retryAfterSeconds = secondsUntilDayReset(nowMs)
): RemoteQuotaError {
  return {
    code,
    message,
    retryAfterSeconds
  };
}
