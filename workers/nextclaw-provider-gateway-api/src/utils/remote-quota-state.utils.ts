import type {
  ConnectionUsage,
  RemoteQuotaDailyUsage,
  RemoteQuotaOperationCost,
  RemoteQuotaSessionState,
  RemoteQuotaState,
  RemoteQuotaUserState,
  RemoteQuotaWindow,
  RequestWindowUsage,
} from "@/configs/remote-quota.config.js";

import { REMOTE_QUOTA_WINDOW_MS } from "@/configs/remote-quota.config.js";

export function createEmptyRemoteQuotaState(nowMs: number): RemoteQuotaState {
  return {
    platformDailyUsage: createDailyUsage(nowMs),
    users: {}
  };
}

export function normalizeRemoteQuotaState(state: RemoteQuotaState | null | undefined, nowMs: number): RemoteQuotaState {
  const nextState = state ?? createEmptyRemoteQuotaState(nowMs);
  const normalizedUsers: Record<string, RemoteQuotaUserState> = {};
  for (const [userId, userState] of Object.entries(nextState.users)) {
    const normalizedUserState = normalizeUserState(userState, nowMs);
    if (shouldKeepUserState(normalizedUserState)) {
      normalizedUsers[userId] = normalizedUserState;
    }
  }
  return {
    platformDailyUsage: normalizeDailyUsage(nextState.platformDailyUsage, nowMs),
    users: normalizedUsers
  };
}

export function collectConnectionUsage(state: RemoteQuotaState, instanceId: string): ConnectionUsage {
  let instanceCount = 0;
  for (const userState of Object.values(state.users)) {
    for (const connection of Object.values(userState.browserConnections)) {
      if (connection.instanceId === instanceId) {
        instanceCount += 1;
      }
    }
  }
  return {
    instanceCount
  };
}

export function readRequestWindowUsage(sessionState: RemoteQuotaSessionState | undefined, nowMs: number): RequestWindowUsage {
  return {
    sessionWindow: normalizeWindow(sessionState?.requestWindow, nowMs)
  };
}

export function addDailyUsage(usage: RemoteQuotaDailyUsage, cost: RemoteQuotaOperationCost): RemoteQuotaDailyUsage {
  return {
    ...usage,
    workerRequestUnits: usage.workerRequestUnits + cost.workerRequestUnits,
    durableObjectMilliUnits: usage.durableObjectMilliUnits + cost.durableObjectMilliUnits
  };
}

export function getUserState(state: RemoteQuotaState, userId: string, nowMs: number): RemoteQuotaUserState {
  return state.users[userId] ?? {
    browserConnections: {},
    dailyUsage: createDailyUsage(nowMs),
    sessions: {}
  };
}

export function applyUserState(state: RemoteQuotaState, userId: string, userState: RemoteQuotaUserState): RemoteQuotaState {
  return {
    ...state,
    users: {
      ...state.users,
      [userId]: userState
    }
  };
}

export function incrementWindow(window: RemoteQuotaWindow): RemoteQuotaWindow {
  return addWindowCount(window, 1);
}

export function addWindowCount(window: RemoteQuotaWindow, count: number): RemoteQuotaWindow {
  return {
    ...window,
    count: window.count + count
  };
}

export function secondsUntilWindowReset(nowMs: number): number {
  const resetMs = alignToWindow(nowMs) + REMOTE_QUOTA_WINDOW_MS;
  return Math.max(1, Math.ceil((resetMs - nowMs) / 1000));
}

export function secondsUntilDayReset(nowMs: number): number {
  const date = new Date(nowMs);
  const nextDayUtcMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(1, Math.ceil((nextDayUtcMs - nowMs) / 1000));
}

export function createDailyUsage(nowMs: number): RemoteQuotaDailyUsage {
  return {
    dayKey: toUtcDayKey(nowMs),
    workerRequestUnits: 0,
    durableObjectMilliUnits: 0
  };
}

export function createWindow(nowMs: number): RemoteQuotaWindow {
  return {
    windowStartedAtMs: alignToWindow(nowMs),
    count: 0
  };
}

function normalizeUserState(userState: RemoteQuotaUserState, nowMs: number): RemoteQuotaUserState {
  const normalizedSessions: Record<string, RemoteQuotaSessionState> = {};
  for (const [sessionId, sessionState] of Object.entries(userState.sessions)) {
    const normalizedSessionState = normalizeSessionState(sessionState, nowMs);
    if (shouldKeepSessionState(normalizedSessionState)) {
      normalizedSessions[sessionId] = normalizedSessionState;
    }
  }
  return {
    browserConnections: { ...userState.browserConnections },
    dailyUsage: normalizeDailyUsage(userState.dailyUsage, nowMs),
    sessions: normalizedSessions
  };
}

function normalizeSessionState(sessionState: RemoteQuotaSessionState, nowMs: number): RemoteQuotaSessionState {
  return {
    requestWindow: normalizeWindow(sessionState.requestWindow, nowMs)
  };
}

function shouldKeepUserState(userState: RemoteQuotaUserState): boolean {
  return Object.keys(userState.browserConnections).length > 0
    || hasDailyUsage(userState.dailyUsage)
    || Object.keys(userState.sessions).length > 0;
}

function shouldKeepSessionState(sessionState: RemoteQuotaSessionState): boolean {
  return sessionState.requestWindow.count > 0;
}

function hasDailyUsage(usage: RemoteQuotaDailyUsage): boolean {
  return usage.workerRequestUnits > 0 || usage.durableObjectMilliUnits > 0;
}

function normalizeDailyUsage(usage: RemoteQuotaDailyUsage | undefined, nowMs: number): RemoteQuotaDailyUsage {
  const dayKey = toUtcDayKey(nowMs);
  if (!usage || usage.dayKey !== dayKey) {
    return createDailyUsage(nowMs);
  }
  return usage;
}

function normalizeWindow(window: RemoteQuotaWindow | undefined, nowMs: number): RemoteQuotaWindow {
  const windowStartedAtMs = alignToWindow(nowMs);
  if (!window || window.windowStartedAtMs !== windowStartedAtMs) {
    return createWindow(nowMs);
  }
  return window;
}

function toUtcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function alignToWindow(nowMs: number): number {
  return Math.floor(nowMs / REMOTE_QUOTA_WINDOW_MS) * REMOTE_QUOTA_WINDOW_MS;
}
