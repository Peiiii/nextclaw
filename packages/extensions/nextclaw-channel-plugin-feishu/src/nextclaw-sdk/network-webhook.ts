import type { IncomingMessage, ServerResponse } from "node:http";

function pruneMapToMaxSize<K, V>(map: Map<K, V>, maxSize: number): void {
  while (map.size > maxSize) {
    const firstKey = map.keys().next().value;
    if (firstKey === undefined) {
      break;
    }
    map.delete(firstKey);
  }
}

export const WEBHOOK_RATE_LIMIT_DEFAULTS = Object.freeze({
  windowMs: 60_000,
  maxRequests: 120,
  maxTrackedKeys: 4_096,
});

export const WEBHOOK_ANOMALY_COUNTER_DEFAULTS = Object.freeze({
  maxTrackedKeys: 4_096,
  ttlMs: 6 * 60 * 60_000,
  logEvery: 25,
});

export function createFixedWindowRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  maxTrackedKeys: number;
  pruneIntervalMs?: number;
}) {
  const state = new Map<string, { count: number; windowStartMs: number }>();
  const windowMs = Math.max(1, Math.floor(options.windowMs));
  const maxRequests = Math.max(1, Math.floor(options.maxRequests));
  const maxTrackedKeys = Math.max(1, Math.floor(options.maxTrackedKeys));
  const pruneIntervalMs = Math.max(1, Math.floor(options.pruneIntervalMs ?? windowMs));
  let lastPruneMs = 0;

  const touch = (key: string, value: { count: number; windowStartMs: number }) => {
    state.delete(key);
    state.set(key, value);
  };

  const prune = (nowMs: number) => {
    for (const [key, entry] of state) {
      if (nowMs - entry.windowStartMs >= windowMs) {
        state.delete(key);
      }
    }
  };

  return {
    isRateLimited(key: string, nowMs = Date.now()): boolean {
      if (!key) {
        return false;
      }
      if (nowMs - lastPruneMs >= pruneIntervalMs) {
        prune(nowMs);
        lastPruneMs = nowMs;
      }
      const existing = state.get(key);
      if (!existing || nowMs - existing.windowStartMs >= windowMs) {
        touch(key, { count: 1, windowStartMs: nowMs });
        pruneMapToMaxSize(state, maxTrackedKeys);
        return false;
      }
      const nextCount = existing.count + 1;
      touch(key, { count: nextCount, windowStartMs: existing.windowStartMs });
      pruneMapToMaxSize(state, maxTrackedKeys);
      return nextCount > maxRequests;
    },
    size: () => state.size,
    clear: () => {
      state.clear();
      lastPruneMs = 0;
    },
  };
}

export function createWebhookAnomalyTracker(options?: {
  maxTrackedKeys?: number;
  ttlMs?: number;
  logEvery?: number;
  trackedStatusCodes?: readonly number[];
}) {
  const trackedStatusCodes = new Set(options?.trackedStatusCodes ?? [400, 401, 408, 413, 415, 429]);
  const counters = new Map<string, { count: number; updatedAtMs: number }>();
  const maxTrackedKeys = Math.max(
    1,
    Math.floor(options?.maxTrackedKeys ?? WEBHOOK_ANOMALY_COUNTER_DEFAULTS.maxTrackedKeys),
  );
  const ttlMs = Math.max(
    0,
    Math.floor(options?.ttlMs ?? WEBHOOK_ANOMALY_COUNTER_DEFAULTS.ttlMs),
  );
  const logEvery = Math.max(
    1,
    Math.floor(options?.logEvery ?? WEBHOOK_ANOMALY_COUNTER_DEFAULTS.logEvery),
  );

  const prune = (nowMs: number) => {
    if (ttlMs <= 0) {
      return;
    }
    for (const [key, entry] of counters) {
      if (nowMs - entry.updatedAtMs >= ttlMs) {
        counters.delete(key);
      }
    }
  };

  return {
    record(params: {
      key: string;
      statusCode: number;
      message: (count: number) => string;
      log?: (message: string) => void;
      nowMs?: number;
    }): number {
      if (!trackedStatusCodes.has(params.statusCode)) {
        return 0;
      }
      const nowMs = params.nowMs ?? Date.now();
      prune(nowMs);
      const existing = counters.get(params.key);
      const nextCount = (existing?.count ?? 0) + 1;
      counters.set(params.key, { count: nextCount, updatedAtMs: nowMs });
      pruneMapToMaxSize(counters, maxTrackedKeys);
      if (params.log && (nextCount === 1 || nextCount % logEvery === 0)) {
        params.log(params.message(nextCount));
      }
      return nextCount;
    },
    size: () => counters.size,
    clear: () => counters.clear(),
  };
}

function isJsonContentType(value: string | string[] | undefined): boolean {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) {
    return false;
  }
  const mediaType = first.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

export function applyBasicWebhookRequestGuards(params: {
  req: IncomingMessage;
  res: ServerResponse;
  allowMethods?: readonly string[];
  rateLimiter?: { isRateLimited: (key: string, nowMs?: number) => boolean };
  rateLimitKey?: string;
  nowMs?: number;
  requireJsonContentType?: boolean;
}): boolean {
  const allowMethods = params.allowMethods?.length ? params.allowMethods : null;
  if (allowMethods && !allowMethods.includes(params.req.method ?? "")) {
    params.res.statusCode = 405;
    params.res.setHeader("Allow", allowMethods.join(", "));
    params.res.end("Method Not Allowed");
    return false;
  }
  if (
    params.rateLimiter &&
    params.rateLimitKey &&
    params.rateLimiter.isRateLimited(params.rateLimitKey, params.nowMs ?? Date.now())
  ) {
    params.res.statusCode = 429;
    params.res.end("Too Many Requests");
    return false;
  }
  if (
    params.requireJsonContentType &&
    params.req.method === "POST" &&
    !isJsonContentType(params.req.headers["content-type"])
  ) {
    params.res.statusCode = 415;
    params.res.end("Unsupported Media Type");
    return false;
  }
  return true;
}
