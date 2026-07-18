import type {
  RemoteQuotaError,
  RemoteQuotaPlatformSummary,
  RemoteQuotaUserSummary,
} from "@/utils/remote-quota-decision.utils.js";
import type { Env } from "@/types/platform";
import { isRecord } from "@/utils/platform.utils";

const REMOTE_QUOTA_GUARD_OBJECT_NAME = "remote-platform-budget-v2";

type RemoteQuotaStubSuccess<T> = {
  ok: true;
  data: T;
};

type RemoteQuotaStubFailure = {
  ok: false;
  degraded: true;
  error: RemoteQuotaError;
};

type RemoteQuotaStubResult<T> = RemoteQuotaStubSuccess<T> | RemoteQuotaStubFailure;

export async function acquireRemoteQuotaBrowserConnection(
  env: Env,
  payload: {
    userId: string;
    sessionId: string;
    instanceId: string;
    clientId: string;
    ticket: string;
  }
): Promise<RemoteQuotaStubResult<{ ticket: string; grantedMessages: number }>> {
  return await callRemoteQuotaStub(env, "/browser-connection/acquire", {
    userId: payload.userId,
    ticket: payload.ticket,
    clientId: payload.clientId,
    sessionId: payload.sessionId,
    instanceId: payload.instanceId
  });
}

export async function releaseRemoteQuotaBrowserConnection(
  env: Env,
  payload: {
    userId: string;
    ticket: string;
    settledMessages: number;
  }
): Promise<void> {
  const result = await callRemoteQuotaStub(env, "/browser-connection/release", {
    userId: payload.userId,
    ticket: payload.ticket,
    settledMessages: payload.settledMessages
  });
  if (!result.ok) {
    console.warn("[remote-quota] browser connection release rejected", result.error.code, result.error.message);
  }
}

export async function consumeRemoteQuotaRequest(
  env: Env,
  payload: {
    userId: string;
    operationKind: "runtime_http" | "proxy_http" | "connector_connect";
  }
): Promise<RemoteQuotaStubResult<{ admitted: true }>> {
  return await callRemoteQuotaStub(env, "/request/consume", {
    userId: payload.userId,
    operationKind: payload.operationKind
  });
}

export async function settleAndLeaseRemoteQuotaBrowserMessages(
  env: Env,
  payload: {
    userId: string;
    ticket: string;
    settledMessages: number;
    requestedMessages: number;
  }
): Promise<RemoteQuotaStubResult<{ grantedMessages: number }>> {
  return await callRemoteQuotaStub(env, "/ws-message/settle-and-lease", {
    userId: payload.userId,
    ticket: payload.ticket,
    settledMessages: payload.settledMessages,
    requestedMessages: payload.requestedMessages
  });
}

export async function recordRemoteQuotaWebSocketMessages(
  env: Env,
  payload: {
    userId: string;
    messages: number;
  }
): Promise<RemoteQuotaStubResult<{ recordedMessages: number }>> {
  return await callRemoteQuotaStub(env, "/ws-message/report", payload);
}

export async function readRemoteQuotaUserSummary(
  env: Env,
  userId: string
): Promise<RemoteQuotaStubResult<RemoteQuotaUserSummary>> {
  const params = new URLSearchParams({ userId });
  return await callRemoteQuotaStub(env, `/summary/user?${params.toString()}`, undefined, "GET");
}

export async function readRemoteQuotaPlatformSummary(
  env: Env
): Promise<RemoteQuotaStubResult<RemoteQuotaPlatformSummary>> {
  return await callRemoteQuotaStub(env, "/summary/platform", undefined, "GET");
}

async function callRemoteQuotaStub<T>(
  env: Env,
  path: string,
  body?: Record<string, unknown>,
  method: "GET" | "POST" = "POST"
): Promise<RemoteQuotaStubResult<T>> {
  const stub = env.NEXTCLAW_REMOTE_QUOTA.get(env.NEXTCLAW_REMOTE_QUOTA.idFromName(REMOTE_QUOTA_GUARD_OBJECT_NAME));
  let response: Response;
  try {
    response = await stub.fetch("https://remote-quota.internal" + path, {
      method,
      ...(method === "POST"
        ? {
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(body ?? {})
        }
        : {})
    });
  } catch (error) {
    return {
      ok: false,
      degraded: true,
      error: {
        code: "REMOTE_QUOTA_GUARD_UNAVAILABLE",
        message: error instanceof Error
          ? "Remote access is temporarily degraded because quota guard is unavailable."
          : "Remote access is temporarily degraded because quota guard is unavailable.",
        retryAfterSeconds: 5
      }
    };
  }

  const parsed = await readQuotaResponsePayload(response);
  if (response.ok && parsed.ok) {
    return parsed as RemoteQuotaStubSuccess<T>;
  }
  const error = parsed.ok
    ? {
      code: "REMOTE_QUOTA_GUARD_UNAVAILABLE" as const,
      message: "Remote access is temporarily degraded because quota guard returned an invalid response.",
      retryAfterSeconds: 5
    }
    : parsed.error;
  return {
    ok: false,
    degraded: true,
    error
  };
}

async function readQuotaResponsePayload(response: Response): Promise<RemoteQuotaStubResult<unknown>> {
  try {
    const payload = await response.json<unknown>();
    if (!isRecord(payload) || typeof payload.ok !== "boolean") {
      return invalidQuotaResponse();
    }
    if (payload.ok) {
      return {
        ok: true,
        data: isRecord(payload.data) ? payload.data : {}
      };
    }
    if (!isRecord(payload.error)) {
      return invalidQuotaResponse();
    }
    const code = typeof payload.error.code === "string" ? payload.error.code : "REMOTE_QUOTA_GUARD_UNAVAILABLE";
    const message = typeof payload.error.message === "string"
      ? payload.error.message
      : "Remote access is temporarily degraded because quota guard rejected the request.";
    const retryAfterSeconds = typeof payload.error.retryAfterSeconds === "number" && Number.isFinite(payload.error.retryAfterSeconds)
      ? payload.error.retryAfterSeconds
      : parseRetryAfterHeader(response.headers);
    return {
      ok: false,
      degraded: true,
      error: {
        code: code as RemoteQuotaError["code"],
        message,
        retryAfterSeconds
      }
    };
  } catch {
    return invalidQuotaResponse();
  }
}

function invalidQuotaResponse(): RemoteQuotaStubFailure {
  return {
    ok: false,
    degraded: true,
    error: {
      code: "REMOTE_QUOTA_GUARD_UNAVAILABLE",
      message: "Remote access is temporarily degraded because quota guard returned an invalid response.",
      retryAfterSeconds: 5
    }
  };
}

function parseRetryAfterHeader(headers: Headers): number {
  const raw = headers.get("retry-after");
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}
