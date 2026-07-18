import type { RemoteQuotaError } from "@/configs/remote-quota.config.js";

type RemoteQuotaFrame = {
  code: RemoteQuotaError["code"];
  degraded: true;
  message: string;
  retryAfterSeconds: number;
};

export function buildRemoteQuotaHttpRejection(error: RemoteQuotaError): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      degraded: true,
      error: {
        code: error.code,
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds
      }
    }),
    {
      status: error.code === "REMOTE_QUOTA_GUARD_UNAVAILABLE" ? 503 : 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(error.retryAfterSeconds),
        "x-nextclaw-degraded": "quota_guard"
      }
    }
  );
}

export function buildRemoteQuotaRequestErrorFrame(
  requestId: string,
  error: RemoteQuotaError
): Record<string, unknown> {
  return {
    type: "request.error",
    id: requestId,
    ...buildRemoteQuotaFrame(error)
  };
}

export function buildRemoteQuotaStreamErrorFrame(
  streamId: string,
  error: RemoteQuotaError
): Record<string, unknown> {
  return {
    type: "stream.error",
    streamId,
    ...buildRemoteQuotaFrame(error)
  };
}

function buildRemoteQuotaFrame(error: RemoteQuotaError): RemoteQuotaFrame {
  return {
    code: error.code,
    degraded: true,
    message: error.message,
    retryAfterSeconds: error.retryAfterSeconds
  };
}
