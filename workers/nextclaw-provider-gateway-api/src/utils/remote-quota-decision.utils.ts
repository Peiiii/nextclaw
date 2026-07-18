export {
  DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET,
  DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT,
  DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
  DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
  DEFAULT_REMOTE_QUOTA_WS_USAGE_REPORT_SIZE,
  REMOTE_BROWSER_CONNECT_COST,
  REMOTE_CONNECTOR_CONNECT_COST,
  REMOTE_PROXY_REQUEST_COST,
  REMOTE_QUOTA_ATTEMPT_COST,
  REMOTE_QUOTA_CONNECTION_RETRY_AFTER_SECONDS,
  REMOTE_QUOTA_COST_MODEL_VERSION,
  REMOTE_QUOTA_COST_MODEL_VERIFIED_AT,
  REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS,
  REMOTE_QUOTA_INTERNAL_REQUEST_COST,
  REMOTE_QUOTA_RECENT_BUCKET_MS,
  REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS,
  REMOTE_RUNTIME_REQUEST_COST,
  type ConnectionUsage,
  type RemoteQuotaBudgets,
  type RemoteQuotaConfig,
  type RemoteQuotaDailyUsage,
  type RemoteQuotaDecision,
  type RemoteQuotaError,
  type RemoteQuotaFailure,
  type RemoteQuotaOperationCost,
  type RemoteQuotaPlatformSummary,
  type RemoteQuotaState,
  type RemoteQuotaSuccess,
  type RemoteQuotaTicket,
  type RemoteQuotaUserState,
  type RemoteQuotaUserSummary,
} from "@/configs/remote-quota.config.js";

import {
  REMOTE_BROWSER_CONNECT_COST,
  REMOTE_QUOTA_ATTEMPT_COST,
  REMOTE_QUOTA_CONNECTION_RETRY_AFTER_SECONDS,
  REMOTE_QUOTA_INTERNAL_REQUEST_COST,
  type RemoteQuotaConfig,
  type RemoteQuotaDecision,
  type RemoteQuotaError,
  type RemoteQuotaOperationCost,
  type RemoteQuotaState,
} from "@/configs/remote-quota.config.js";
import {
  computeMaxGrantableWsMessages,
  evaluateDailyBudget,
} from "@/utils/remote-quota-budget.utils.js";
import {
  addOperationCosts,
  applyActualUsage,
  applyReservedUsage,
  applyUserState,
  collectConnectionUsage,
  createTicketReservation,
  createWsMessageCost,
  getUserState,
  normalizeRemoteQuotaState,
  releaseReservedUsage,
  subtractOperationCosts,
} from "@/utils/remote-quota-state.utils.js";

export { createEmptyRemoteQuotaState } from "@/utils/remote-quota-state.utils.js";
export {
  readRemoteQuotaPlatformSummary,
  readRemoteQuotaUserSummary
} from "@/utils/remote-quota-summary.utils.js";

export function acquireRemoteBrowserConnection(
  state: RemoteQuotaState | null | undefined,
  config: RemoteQuotaConfig,
  input: {
    nowMs: number;
    userId: string;
    ticket: string;
    clientId: string;
    sessionId: string;
    instanceId: string;
  }
): RemoteQuotaDecision<{ ticket: string; grantedMessages: number }> {
  const normalizedState = normalizeRemoteQuotaState(state, input.nowMs);
  const attemptedState = applyActualUsage(normalizedState, input.userId, REMOTE_QUOTA_ATTEMPT_COST, input.nowMs);
  const connectionUsage = collectConnectionUsage(attemptedState, input.instanceId);
  if (connectionUsage.instanceCount >= config.instanceConnections) {
    return reject(attemptedState, {
      code: "REMOTE_INSTANCE_CONNECTION_LIMIT",
      message: "Remote access is temporarily degraded because this instance has too many active browser connections.",
      retryAfterSeconds: REMOTE_QUOTA_CONNECTION_RETRY_AFTER_SECONDS
    });
  }

  const continuationCost = subtractOperationCosts(REMOTE_BROWSER_CONNECT_COST, REMOTE_QUOTA_ATTEMPT_COST);
  const fixedCommitment = addOperationCosts(continuationCost, REMOTE_QUOTA_INTERNAL_REQUEST_COST);
  const fixedError = evaluateDailyBudget(config, readUsage(attemptedState, input.userId, input.nowMs), input.nowMs, fixedCommitment);
  if (fixedError) {
    return reject(attemptedState, fixedError);
  }

  const continuedState = applyActualUsage(attemptedState, input.userId, continuationCost, input.nowMs);
  const releaseReservedState = applyReservedUsage(
    continuedState,
    input.userId,
    REMOTE_QUOTA_INTERNAL_REQUEST_COST,
    input.nowMs
  );
  const grantedMessages = Math.min(
    config.wsMessageLeaseSize,
    computeMaxGrantableWsMessages(config, readUsage(releaseReservedState, input.userId, input.nowMs))
  );
  const ticket = {
    ticket: input.ticket,
    clientId: input.clientId,
    sessionId: input.sessionId,
    instanceId: input.instanceId,
    connectedAtMs: input.nowMs,
    reservedMessages: grantedMessages
  };
  const userState = getUserState(releaseReservedState, input.userId, input.nowMs);
  const connectedState = applyUserState(releaseReservedState, input.userId, {
    ...userState,
    browserConnections: {
      ...userState.browserConnections,
      [input.ticket]: ticket
    }
  });
  const finalState = applyReservedUsage(
    connectedState,
    input.userId,
    createWsMessageCost(grantedMessages),
    input.nowMs
  );
  return accept(finalState, { ticket: input.ticket, grantedMessages });
}

export function releaseRemoteBrowserConnection(
  state: RemoteQuotaState | null | undefined,
  input: {
    nowMs: number;
    userId: string;
    ticket: string;
    settledMessages: number;
  }
): RemoteQuotaDecision<{ released: boolean }> {
  const normalizedState = normalizeRemoteQuotaState(state, input.nowMs);
  const userState = getUserState(normalizedState, input.userId, input.nowMs);
  const ticket = userState.browserConnections[input.ticket];
  if (!ticket) {
    return accept(
      applyActualUsage(normalizedState, input.userId, REMOTE_QUOTA_INTERNAL_REQUEST_COST, input.nowMs),
      { released: false }
    );
  }

  const releasedState = releaseReservedUsage(
    normalizedState,
    input.userId,
    createTicketReservation(ticket),
    input.nowMs
  );
  const settledState = applyActualUsage(
    releasedState,
    input.userId,
    addOperationCosts(REMOTE_QUOTA_INTERNAL_REQUEST_COST, createWsMessageCost(input.settledMessages)),
    input.nowMs
  );
  const settledUser = getUserState(settledState, input.userId, input.nowMs);
  const nextConnections = { ...settledUser.browserConnections };
  delete nextConnections[input.ticket];
  return accept(applyUserState(settledState, input.userId, {
    ...settledUser,
    browserConnections: nextConnections
  }), { released: true });
}

export function consumeRemoteRequestQuota(
  state: RemoteQuotaState | null | undefined,
  config: RemoteQuotaConfig,
  input: {
    nowMs: number;
    userId: string;
    operationCost: RemoteQuotaOperationCost;
  }
): RemoteQuotaDecision<{ admitted: true }> {
  const normalizedState = normalizeRemoteQuotaState(state, input.nowMs);
  const attemptedState = applyActualUsage(normalizedState, input.userId, REMOTE_QUOTA_ATTEMPT_COST, input.nowMs);
  const continuationCost = subtractOperationCosts(input.operationCost, REMOTE_QUOTA_ATTEMPT_COST);
  const dailyError = evaluateDailyBudget(
    config,
    readUsage(attemptedState, input.userId, input.nowMs),
    input.nowMs,
    continuationCost
  );
  if (dailyError) {
    return reject(attemptedState, dailyError);
  }
  return accept(
    applyActualUsage(attemptedState, input.userId, continuationCost, input.nowMs),
    { admitted: true }
  );
}

export function settleAndLeaseRemoteBrowserMessages(
  state: RemoteQuotaState | null | undefined,
  config: RemoteQuotaConfig,
  input: {
    nowMs: number;
    userId: string;
    ticket: string;
    settledMessages: number;
    requestedMessages: number;
  }
): RemoteQuotaDecision<{ grantedMessages: number }> {
  const normalizedState = normalizeRemoteQuotaState(state, input.nowMs);
  const userState = getUserState(normalizedState, input.userId, input.nowMs);
  const ticket = userState.browserConnections[input.ticket];
  if (!ticket) {
    return reject(
      applyActualUsage(normalizedState, input.userId, REMOTE_QUOTA_INTERNAL_REQUEST_COST, input.nowMs),
      {
        code: "REMOTE_QUOTA_CONNECTION_NOT_FOUND",
        message: "Remote access quota state no longer contains this browser connection.",
        retryAfterSeconds: REMOTE_QUOTA_CONNECTION_RETRY_AFTER_SECONDS
      }
    );
  }

  const wasCoveredByReservation = input.settledMessages <= ticket.reservedMessages;
  const releasedState = releaseReservedUsage(
    normalizedState,
    input.userId,
    createTicketReservation(ticket),
    input.nowMs
  );
  const settledState = applyActualUsage(
    releasedState,
    input.userId,
    addOperationCosts(REMOTE_QUOTA_INTERNAL_REQUEST_COST, createWsMessageCost(input.settledMessages)),
    input.nowMs
  );
  const currentUser = getUserState(settledState, input.userId, input.nowMs);
  const ticketResetState = applyUserState(settledState, input.userId, {
    ...currentUser,
    browserConnections: {
      ...currentUser.browserConnections,
      [input.ticket]: {
        ...ticket,
        reservedMessages: 0
      }
    }
  });
  const transitionError = evaluateDailyBudget(
    config,
    readUsage(ticketResetState, input.userId, input.nowMs),
    input.nowMs,
    REMOTE_QUOTA_INTERNAL_REQUEST_COST
  );
  if (transitionError) {
    return wasCoveredByReservation
      ? accept(ticketResetState, { grantedMessages: 0 })
      : reject(ticketResetState, transitionError);
  }

  const transitionReservedState = applyReservedUsage(
    ticketResetState,
    input.userId,
    REMOTE_QUOTA_INTERNAL_REQUEST_COST,
    input.nowMs
  );
  const grantedMessages = Math.min(
    Math.max(1, input.requestedMessages),
    computeMaxGrantableWsMessages(config, readUsage(transitionReservedState, input.userId, input.nowMs))
  );
  const updatedUser = getUserState(transitionReservedState, input.userId, input.nowMs);
  const updatedState = applyUserState(transitionReservedState, input.userId, {
    ...updatedUser,
    browserConnections: {
      ...updatedUser.browserConnections,
      [input.ticket]: {
        ...ticket,
        reservedMessages: grantedMessages
      }
    }
  });
  return accept(
    applyReservedUsage(updatedState, input.userId, createWsMessageCost(grantedMessages), input.nowMs),
    { grantedMessages }
  );
}

export function recordRemoteWebSocketMessages(
  state: RemoteQuotaState | null | undefined,
  config: RemoteQuotaConfig,
  input: {
    nowMs: number;
    userId: string;
    messages: number;
  }
): RemoteQuotaDecision<{ recordedMessages: number }> {
  const normalizedState = normalizeRemoteQuotaState(state, input.nowMs);
  const recordedMessages = Math.max(0, input.messages);
  const recordedState = applyActualUsage(
    normalizedState,
    input.userId,
    addOperationCosts(REMOTE_QUOTA_INTERNAL_REQUEST_COST, createWsMessageCost(recordedMessages)),
    input.nowMs
  );
  const budgetError = evaluateDailyBudget(
    config,
    readUsage(recordedState, input.userId, input.nowMs),
    input.nowMs,
    { workerRequestUnits: 0, durableObjectMilliUnits: 0 }
  );
  return budgetError
    ? reject(recordedState, budgetError)
    : accept(recordedState, { recordedMessages });
}

function readUsage(state: RemoteQuotaState, userId: string, nowMs: number) {
  const userState = getUserState(state, userId, nowMs);
  return {
    platformActual: state.platformDailyUsage,
    platformReserved: state.platformDailyReserved,
    userActual: userState.dailyUsage,
    userReserved: userState.dailyReserved
  };
}

function accept<T>(state: RemoteQuotaState, data: T) {
  return { ok: true, data, state } as const;
}

function reject(state: RemoteQuotaState, error: RemoteQuotaError) {
  return { ok: false, error, state } as const;
}
