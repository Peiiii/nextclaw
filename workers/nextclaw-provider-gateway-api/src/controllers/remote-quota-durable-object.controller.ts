import {
  acquireRemoteBrowserConnection,
  consumeRemoteRequestQuota,
  createEmptyRemoteQuotaState,
  DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET,
  DEFAULT_REMOTE_PLATFORM_DAILY_RESERVE_PERCENT,
  DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
  DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS,
  DEFAULT_REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE,
  DEFAULT_REMOTE_QUOTA_WS_USAGE_REPORT_SIZE,
  recordRemoteWebSocketMessages,
  readRemoteQuotaPlatformSummary,
  readRemoteQuotaUserSummary,
  releaseRemoteBrowserConnection,
  settleAndLeaseRemoteBrowserMessages,
  REMOTE_CONNECTOR_CONNECT_COST,
  REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS,
  REMOTE_PROXY_REQUEST_COST,
  REMOTE_RUNTIME_REQUEST_COST,
  type RemoteQuotaConfig,
  type RemoteQuotaDecision,
  type RemoteQuotaOperationCost,
  type RemoteQuotaState,
} from "@/utils/remote-quota-decision.utils.js";
import type { RemoteQuotaEnv as Env } from "@/types/remote-quota-env.types";
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
    if (url.pathname === "/ws-message/settle-and-lease") {
      return await this.handleWsMessageSettleAndLease(request);
    }
    if (url.pathname === "/ws-message/report") {
      return await this.handleWsMessageReport(request);
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
    const settledMessages = readNonNegativeInteger(payload, "settledMessages");
    if (!userId || !ticket || settledMessages === null) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_REQUEST", "userId, ticket, and settledMessages are required.");
    }

    return await this.runMutation((storedState, _config, nowMs) => {
      return releaseRemoteBrowserConnection(storedState, {
        nowMs,
        userId,
        ticket,
        settledMessages
      });
    });
  }

  private handleRequestConsume = async (request: Request): Promise<Response> => {
    const payload = await readQuotaPayload(request);
    const userId = readRequiredString(payload, "userId");
    const operationKind = readRequiredString(payload, "operationKind");
    if (!userId || !operationKind) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_REQUEST", "userId and operationKind are required.");
    }

    const operationCost = resolveOperationCost(operationKind);
    if (!operationCost) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_OPERATION", "Unsupported quota operation kind.");
    }

    return await this.runMutation((storedState, config, nowMs) => {
      return consumeRemoteRequestQuota(storedState, config, {
        nowMs,
        userId,
        operationCost
      });
    });
  }

  private handleWsMessageSettleAndLease = async (request: Request): Promise<Response> => {
    const payload = await readQuotaPayload(request);
    const userId = readRequiredString(payload, "userId");
    const ticket = readRequiredString(payload, "ticket");
    const settledMessages = readNonNegativeInteger(payload, "settledMessages");
    const requestedMessages = readNonNegativeInteger(payload, "requestedMessages");
    if (!userId || !ticket || settledMessages === null || requestedMessages === null) {
      return jsonErrorResponse(
        400,
        "REMOTE_QUOTA_INVALID_REQUEST",
        "userId, ticket, settledMessages, and requestedMessages are required."
      );
    }

    return await this.runMutation((storedState, config, nowMs) => {
      return settleAndLeaseRemoteBrowserMessages(storedState, config, {
        nowMs,
        userId,
        ticket,
        settledMessages,
        requestedMessages: Math.max(1, Math.min(config.wsMessageLeaseSize, requestedMessages))
      });
    });
  }

  private handleWsMessageReport = async (request: Request): Promise<Response> => {
    const payload = await readQuotaPayload(request);
    const userId = readRequiredString(payload, "userId");
    const messages = readNonNegativeInteger(payload, "messages");
    if (!userId || messages === null || messages < 1) {
      return jsonErrorResponse(400, "REMOTE_QUOTA_INVALID_REQUEST", "userId and a positive messages count are required.");
    }

    return await this.runMutation((storedState, config, nowMs) => {
      return recordRemoteWebSocketMessages(storedState, config, {
        nowMs,
        userId,
        messages: Math.min(config.wsUsageReportSize, messages)
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
  if (env.REMOTE_CLOUDFLARE_PLAN_PROFILE !== "workers-free") {
    throw new Error("REMOTE_CLOUDFLARE_PLAN_PROFILE must be explicitly set to workers-free.");
  }
  return {
    planProfile: "workers-free",
    instanceConnections: parseBoundedInt(
      env.REMOTE_QUOTA_INSTANCE_CONNECTIONS,
      DEFAULT_REMOTE_QUOTA_INSTANCE_CONNECTIONS,
      1,
      10_000
    ),
    platformDailyWorkerRequestBudget: DEFAULT_REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET,
    platformDailyDoRequestBudgetMilli:
      DEFAULT_REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET * REMOTE_QUOTA_DO_REQUEST_MILLI_UNITS,
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
    ),
    wsUsageReportSize: parseBoundedInt(
      env.REMOTE_QUOTA_WS_USAGE_REPORT_SIZE,
      DEFAULT_REMOTE_QUOTA_WS_USAGE_REPORT_SIZE,
      1,
      1_000
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
  if (operationKind === "connector_connect") {
    return REMOTE_CONNECTOR_CONNECT_COST;
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

function readNonNegativeInteger(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
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
