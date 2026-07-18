import {
  REMOTE_QUOTA_COST_MODEL_VERSION,
  REMOTE_QUOTA_RECENT_BUCKET_COUNT,
  REMOTE_QUOTA_RECENT_BUCKET_MS,
  REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS,
  REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS,
  type ConnectionUsage,
  type RemoteQuotaDailyUsage,
  type RemoteQuotaOperationCost,
  type RemoteQuotaState,
  type RemoteQuotaTicket,
  type RemoteQuotaUsageBucket,
  type RemoteQuotaUserState,
} from "@/configs/remote-quota.config.js";

export function createEmptyRemoteQuotaState(nowMs: number): RemoteQuotaState {
  return {
    costModelVersion: REMOTE_QUOTA_COST_MODEL_VERSION,
    initializedAtMs: nowMs,
    platformDailyUsage: createDailyUsage(nowMs),
    platformDailyReserved: createDailyUsage(nowMs),
    platformRecentUsage: [],
    users: {}
  };
}

export function normalizeRemoteQuotaState(
  state: RemoteQuotaState | null | undefined,
  nowMs: number
): RemoteQuotaState {
  if (!state || state.costModelVersion !== REMOTE_QUOTA_COST_MODEL_VERSION) {
    return createEmptyRemoteQuotaState(nowMs);
  }

  const users: Record<string, RemoteQuotaUserState> = {};
  let platformDailyReserved = createDailyUsage(nowMs);
  for (const [userId, userState] of Object.entries(state.users ?? {})) {
    const normalizedUser = normalizeUserState(userState, nowMs);
    if (!shouldKeepUserState(normalizedUser)) {
      continue;
    }
    users[userId] = normalizedUser;
    platformDailyReserved = addDailyUsage(platformDailyReserved, normalizedUser.dailyReserved);
  }

  return {
    costModelVersion: REMOTE_QUOTA_COST_MODEL_VERSION,
    initializedAtMs: state.initializedAtMs,
    platformDailyUsage: normalizeDailyUsage(state.platformDailyUsage, nowMs),
    platformDailyReserved,
    platformRecentUsage: normalizeRecentUsage(state.platformRecentUsage, nowMs),
    users
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
  return { instanceCount };
}

export function getUserState(state: RemoteQuotaState, userId: string, nowMs: number): RemoteQuotaUserState {
  return state.users[userId] ?? createUserState(nowMs);
}

export function applyUserState(
  state: RemoteQuotaState,
  userId: string,
  userState: RemoteQuotaUserState
): RemoteQuotaState {
  return {
    ...state,
    users: {
      ...state.users,
      [userId]: userState
    }
  };
}

export function applyActualUsage(
  state: RemoteQuotaState,
  userId: string,
  cost: RemoteQuotaOperationCost,
  nowMs: number
): RemoteQuotaState {
  if (isZeroCost(cost)) {
    return state;
  }
  const userState = getUserState(state, userId, nowMs);
  return {
    ...applyUserState(state, userId, {
      ...userState,
      dailyUsage: addDailyUsage(userState.dailyUsage, cost),
      recentUsage: addRecentUsage(userState.recentUsage, cost, nowMs)
    }),
    platformDailyUsage: addDailyUsage(state.platformDailyUsage, cost),
    platformRecentUsage: addRecentUsage(state.platformRecentUsage, cost, nowMs)
  };
}

export function applyReservedUsage(
  state: RemoteQuotaState,
  userId: string,
  cost: RemoteQuotaOperationCost,
  nowMs: number
): RemoteQuotaState {
  if (isZeroCost(cost)) {
    return state;
  }
  const userState = getUserState(state, userId, nowMs);
  return {
    ...applyUserState(state, userId, {
      ...userState,
      dailyReserved: addDailyUsage(userState.dailyReserved, cost)
    }),
    platformDailyReserved: addDailyUsage(state.platformDailyReserved, cost)
  };
}

export function releaseReservedUsage(
  state: RemoteQuotaState,
  userId: string,
  cost: RemoteQuotaOperationCost,
  nowMs: number
): RemoteQuotaState {
  if (isZeroCost(cost)) {
    return state;
  }
  const userState = getUserState(state, userId, nowMs);
  return {
    ...applyUserState(state, userId, {
      ...userState,
      dailyReserved: subtractDailyUsage(userState.dailyReserved, cost)
    }),
    platformDailyReserved: subtractDailyUsage(state.platformDailyReserved, cost)
  };
}

export function addDailyUsage(
  usage: RemoteQuotaDailyUsage,
  cost: RemoteQuotaOperationCost
): RemoteQuotaDailyUsage {
  return {
    ...usage,
    workerRequestUnits: usage.workerRequestUnits + cost.workerRequestUnits,
    durableObjectMilliUnits: usage.durableObjectMilliUnits + cost.durableObjectMilliUnits
  };
}

export function addOperationCosts(
  left: RemoteQuotaOperationCost,
  right: RemoteQuotaOperationCost
): RemoteQuotaOperationCost {
  return {
    workerRequestUnits: left.workerRequestUnits + right.workerRequestUnits,
    durableObjectMilliUnits: left.durableObjectMilliUnits + right.durableObjectMilliUnits
  };
}

export function subtractOperationCosts(
  total: RemoteQuotaOperationCost,
  cost: RemoteQuotaOperationCost
): RemoteQuotaOperationCost {
  return {
    workerRequestUnits: Math.max(0, total.workerRequestUnits - cost.workerRequestUnits),
    durableObjectMilliUnits: Math.max(0, total.durableObjectMilliUnits - cost.durableObjectMilliUnits)
  };
}

export function createWsMessageCost(messages: number): RemoteQuotaOperationCost {
  return {
    workerRequestUnits: 0,
    durableObjectMilliUnits: Math.max(0, messages) * REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS
  };
}

export function createTicketReservation(ticket: Pick<RemoteQuotaTicket, "reservedMessages">): RemoteQuotaOperationCost {
  return {
    workerRequestUnits: 0,
    durableObjectMilliUnits:
      REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS
      + ticket.reservedMessages * REMOTE_QUOTA_RELAY_WS_MESSAGE_DO_MILLI_UNITS
  };
}

export function secondsUntilDayReset(nowMs: number): number {
  const date = new Date(nowMs);
  const nextDayUtcMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(1, Math.ceil((nextDayUtcMs - nowMs) / 1_000));
}

export function createDailyUsage(nowMs: number): RemoteQuotaDailyUsage {
  return {
    dayKey: toUtcDayKey(nowMs),
    workerRequestUnits: 0,
    durableObjectMilliUnits: 0
  };
}

export function startOfUtcDayMs(nowMs: number): number {
  const date = new Date(nowMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function createUserState(nowMs: number): RemoteQuotaUserState {
  return {
    browserConnections: {},
    dailyUsage: createDailyUsage(nowMs),
    dailyReserved: createDailyUsage(nowMs),
    recentUsage: []
  };
}

function normalizeUserState(userState: RemoteQuotaUserState, nowMs: number): RemoteQuotaUserState {
  const browserConnections = { ...(userState.browserConnections ?? {}) };
  return {
    browserConnections,
    dailyUsage: normalizeDailyUsage(userState.dailyUsage, nowMs),
    dailyReserved: Object.values(browserConnections).reduce(
      (usage, ticket) => addDailyUsage(usage, createTicketReservation(ticket)),
      createDailyUsage(nowMs)
    ),
    recentUsage: normalizeRecentUsage(userState.recentUsage, nowMs)
  };
}

function addRecentUsage(
  usage: RemoteQuotaUsageBucket[],
  cost: RemoteQuotaOperationCost,
  nowMs: number
): RemoteQuotaUsageBucket[] {
  const normalized = normalizeRecentUsage(usage, nowMs);
  const startedAtMs = alignToRecentBucket(nowMs);
  const current = normalized.find((bucket) => bucket.startedAtMs === startedAtMs);
  if (!current) {
    return [...normalized, { startedAtMs, ...cost }];
  }
  return normalized.map((bucket) => bucket.startedAtMs === startedAtMs
    ? {
      ...bucket,
      workerRequestUnits: bucket.workerRequestUnits + cost.workerRequestUnits,
      durableObjectMilliUnits: bucket.durableObjectMilliUnits + cost.durableObjectMilliUnits
    }
    : bucket);
}

function normalizeRecentUsage(
  usage: RemoteQuotaUsageBucket[] | undefined,
  nowMs: number
): RemoteQuotaUsageBucket[] {
  const oldestBucketMs = alignToRecentBucket(nowMs)
    - (REMOTE_QUOTA_RECENT_BUCKET_COUNT - 1) * REMOTE_QUOTA_RECENT_BUCKET_MS;
  return (usage ?? [])
    .filter((bucket) => bucket.startedAtMs >= oldestBucketMs)
    .sort((left, right) => left.startedAtMs - right.startedAtMs)
    .slice(-REMOTE_QUOTA_RECENT_BUCKET_COUNT);
}

function normalizeDailyUsage(
  usage: RemoteQuotaDailyUsage | undefined,
  nowMs: number
): RemoteQuotaDailyUsage {
  if (!usage || usage.dayKey !== toUtcDayKey(nowMs)) {
    return createDailyUsage(nowMs);
  }
  return usage;
}

function subtractDailyUsage(
  usage: RemoteQuotaDailyUsage,
  cost: RemoteQuotaOperationCost
): RemoteQuotaDailyUsage {
  return {
    ...usage,
    workerRequestUnits: Math.max(0, usage.workerRequestUnits - cost.workerRequestUnits),
    durableObjectMilliUnits: Math.max(0, usage.durableObjectMilliUnits - cost.durableObjectMilliUnits)
  };
}

function shouldKeepUserState(userState: RemoteQuotaUserState): boolean {
  return Object.keys(userState.browserConnections).length > 0
    || hasUsage(userState.dailyUsage)
    || hasUsage(userState.dailyReserved)
    || userState.recentUsage.length > 0;
}

function hasUsage(usage: RemoteQuotaOperationCost): boolean {
  return usage.workerRequestUnits > 0 || usage.durableObjectMilliUnits > 0;
}

function isZeroCost(cost: RemoteQuotaOperationCost): boolean {
  return cost.workerRequestUnits === 0 && cost.durableObjectMilliUnits === 0;
}

function toUtcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function alignToRecentBucket(nowMs: number): number {
  return Math.floor(nowMs / REMOTE_QUOTA_RECENT_BUCKET_MS) * REMOTE_QUOTA_RECENT_BUCKET_MS;
}
