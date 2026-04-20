import {
  acquireRemoteBrowserConnection,
  consumeRemoteRequestQuota,
  createEmptyRemoteQuotaState,
  DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET,
  DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT,
  DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
  DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS,
  DEFAULT_REMOTE_QUOTA_SESSION_REQUESTS_PER_MINUTE,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
  leaseRemoteBrowserMessages,
  readRemoteQuotaPlatformSummary,
  readRemoteQuotaUserSummary,
  releaseRemoteBrowserConnection,
  REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS,
  REMOTE_PROXY_REQUEST_COST,
  REMOTE_RUNTIME_REQUEST_COST,
  type RemoteQuotaConfig,
  type RemoteQuotaDecision,
  type RemoteQuotaOperationCost,
  type RemoteQuotaState,
} from "@/services/remote-quota.service.js";
import type { Env } from "@/types/platform";
import { isRecord, jsonErrorResponse, parseBoundedInt } from "@/utils/platform.utils";

const REMOTE_QUOTA_STATE_STORAGE_KEY = "remote-quota-state";

export class NextclawRemoteQuotaDurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {}

  fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method === "GET") {
      if (url.pathname === "/summary/user") {
        return await this.handleUserSummary(url);
      }
      if (url.pathname === "/summary/platform") {
        return await this.handlePlatformSummary();
      }
      return new Response("not_found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("method_not_allowed", { status: 405 });
    }

    if (url.pathname === "/browser-connection/acquire") {
      return await this.handleBrowserConnectionAcquire(request);
    }
    if (url.pathname === "/browser-connection/release") {
      return await this.handleBrowserConnectionRelease(request);
    }
    if (url.pathname === "/request/consume") {
      return await this.handleRequestConsume(request);
    }
    if (url.pathname === "/ws-message/lease") {
      return await this.handleWsMessageLease(request);
    }
    return new Response("not_found", { status: 404 });
  }

  private handleUserSummary = async (url: URL): Promise<Response> => {
    const userId = (url.searchParams.get("userId") ?? "").trim();
    if (!userId) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_REQUEST", "userId is required.");
    }

    const nowMs = Date.now();
    const storedState = await this.readStoredState(nowMs);
    const config = readRemoteQuotaConfig(this.env);
    return jsonSummaryResponse(readRemoteQuotaUserSummary(storedState, config, userId, nowMs));
  }

  private handlePlatformSummary = async (): Promise<Response> => {
    const nowMs = Date.now();
    const storedState = await this.readStoredState(nowMs);
    const config = readRemoteQuotaConfig(this.env);
    return jsonSummaryResponse(readRemoteQuotaPlatformSummary(storedState, config, nowMs));
  }

  private handleBrowserConnectionAcquire = async (request: Request): Promise<Response> => {
    const payload = await readQuotaPayload(request);
    const userId = readRequiredString(payload, "userId");
    const ticket = readRequiredString(payload, "ticket");
    const clientId = readRequiredString(payload, "clientId");
    const sessionId = readRequiredString(payload, "sessionId");
    const instanceId = readRequiredString(payload, "instanceId");
    if (!userId || !ticket || !clientId || !sessionId || !instanceId) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_REQUEST", "userId, ticket, clientId, sessionId, and instanceId are required.");
    }

    return await this.runMutation((storedState, config, nowMs) => {
      return acquireRemoteBrowserConnection(storedState, config, {
        nowMs,
        userId,
        ticket,
        clientId,
        sessionId,
        instanceId
      });
    });
  }

  private handleBrowserConnectionRelease = async (request: Request): Promise<Response> => {
    const payload = await readQuotaPayload(request);
    const userId = readRequiredString(payload, "userId");
    const ticket = readRequiredString(payload, "ticket");
    if (!userId || !ticket) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_REQUEST", "userId and ticket are required.");
    }

    return await this.runMutation((storedState, _config, nowMs) => {
      return releaseRemoteBrowserConnection(storedState, nowMs, userId, ticket);
    });
  }

  private handleRequestConsume = async (request: Request): Promise<Response> => {
    const payload = await readQuotaPayload(request);
    const userId = readRequiredString(payload, "userId");
    const sessionId = readRequiredString(payload, "sessionId");
    const operationKind = readRequiredString(payload, "operationKind");
    if (!userId || !sessionId || !operationKind) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_REQUEST", "userId, sessionId, and operationKind are required.");
    }

    const operationCost = resolveOperationCost(operationKind);
    if (!operationCost) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_OPERATION", "Unsupported quota operation kind.");
    }

    return await this.runMutation((storedState, config, nowMs) => {
      return consumeRemoteRequestQuota(storedState, config, {
        nowMs,
        userId,
        sessionId,
        operationCost
      });
    });
  }

  private handleWsMessageLease = async (request: Request): Promise<Response> => {
    const payload = await readQuotaPayload(request);
    const userId = readRequiredString(payload, "userId");
    const sessionId = readRequiredString(payload, "sessionId");
    const requestedMessagesRaw = payload.requestedMessages;
    if (!userId || !sessionId || typeof requestedMessagesRaw !== "number" || !Number.isFinite(requestedMessagesRaw)) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_REQUEST", "userId, sessionId, and requestedMessages are required.");
    }

    return await this.runMutation((storedState, config, nowMs) => {
      return leaseRemoteBrowserMessages(storedState, config, {
        nowMs,
        userId,
        sessionId,
        requestedMessages: Math.max(1, Math.min(config.wsMessageLeaseSize, Math.floor(requestedMessagesRaw)))
      });
    });
  }

  private runMutation = async <T>(
    mutate: (
      storedState: RemoteQuotaState,
      config: RemoteQuotaConfig,
      nowMs: number
    ) => RemoteQuotaDecision<T>
  ): Promise<Response> => {
    const nowMs = Date.now();
    const storedState = await this.readStoredState(nowMs);
    const decision = mutate(storedState, readRemoteQuotaConfig(this.env), nowMs);
    await this.state.storage.put(REMOTE_QUOTA_STATE_STORAGE_KEY, decision.state);
    return buildQuotaDecisionResponse(decision);
  }

  private readStoredState = async (nowMs: number): Promise<RemoteQuotaState> => {
    return (await this.state.storage.get<RemoteQuotaState>(REMOTE_QUOTA_STATE_STORAGE_KEY))
      ?? createEmptyRemoteQuotaState(nowMs);
  }
}

export { NextclawRemoteQuotaDurableObject as NextclawQuotaDurableObject };

function readRemoteQuotaConfig(env: Env): RemoteQuotaConfig {
  return {
    sessionRequestsPerMinute: parseBoundedInt(
      env.REMOTE_QUOTA_SESSION_REQUESTS_PER_MINUTE,
      DEFAULT_REMOTE_QUOTA_SESSION_REQUESTS_PER_MINUTE,
      5,
      10_000
    ),
    instanceConnections: parseBoundedInt(
      env.REMOTE_QUOTA_INSTANCE_CONNECTIONS,
      DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS,
      1,
      10_000
    ),
    platformDailyWorkerRequestBudget: parseBoundedInt(
      env.REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
      DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
      1_000,
      10_000_000
    ),
    platformDailyDoRequestBudgetMilli: parseBoundedInt(
      env.REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET,
      DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET,
      1_000,
      10_000_000
    ) * REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS,
    platformDailyReservePercent: parseBoundedInt(
      env.REMOTE_PLATFORM_DAILY_RESERVE_PERCENT,
      DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT,
      0,
      90
    ),
    userDailyWorkerRequestUnits: parseBoundedInt(
      env.REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
      DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
      10,
      100_000
    ),
    userDailyDoRequestBudgetMilli: parseBoundedInt(
      env.REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS,
      DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS,
      10,
      1_000_000
    ) * REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS,
    wsMessageLeaseSize: parseBoundedInt(
      env.REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
      DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
      1,
      100
    )
  };
}

function resolveOperationCost(operationKind: string): RemoteQuotaOperationCost | null {
  if (operationKind === "runtime_http") {
    return REMOTE_RUNTIME_REQUEST_COST;
  }
  if (operationKind === "proxy_http") {
    return REMOTE_PROXY_REQUEST_COST;
  }
  return null;
}

function buildQuotaDecisionResponse<T>(decision: RemoteQuotaDecision<T>): Response {
  if (decision.ok) {
    return new Response(
      JSON.stringify({
        ok: true,
        data: decision.data
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }
  return new Response(
    JSON.stringify({
      ok: false,
      degraded: true,
      error: {
        ...decision.error
      }
    }),
    {
      status: 429,
      headers: buildQuotaHeaders(decision.error.retryAfterSeconds)
    }
  );
}

async function readQuotaPayload(request: Request): Promise<Record<string, unknown>> {
  try {
    const payload = await request.json<unknown>();
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

function readRequiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function buildQuotaHeaders(retryAfterSeconds: number): HeadersInit {
  return {
    "content-type": "application/json",
    "retry-after": String(retryAfterSeconds),
    "x-nextclaw-degraded": "quota_guard"
  };
}

function jsonSummaryResponse<T>(data: T): Response {
  return new Response(JSON.stringify({
    ok: true,
    data
  }), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}
