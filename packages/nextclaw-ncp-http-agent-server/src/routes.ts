import type { Context } from "hono";
import {
  parseAbortPayload,
  parseRequestEnvelope,
  parseResumePayloadFromUrl,
} from "./parsers.js";
import { createForwardResponse, createReplayResponse } from "./stream-handlers.js";
import type { NcpHttpAgentServerOptions } from "./types.js";

export type RouteHandlerOptions = {
  agentEndpoint: NcpHttpAgentServerOptions["agentEndpoint"];
  replayProvider: NcpHttpAgentServerOptions["replayProvider"];
  timeoutMs: number;
};

export async function handleSend(c: Context, options: RouteHandlerOptions): Promise<Response> {
  const envelope = await parseRequestEnvelope(c.req.raw);
  if (!envelope) {
    return c.json({ ok: false, error: { code: "INVALID_BODY", message: "Invalid NCP request envelope." } }, 400);
  }

  return createForwardResponse({
    endpoint: options.agentEndpoint,
    requestEvent: { type: "message.request", payload: envelope },
    requestSignal: c.req.raw.signal,
    timeoutMs: options.timeoutMs,
    scope: {
      sessionId: envelope.sessionId,
      correlationId: envelope.correlationId,
    },
  });
}

export async function handleReconnect(c: Context, options: RouteHandlerOptions): Promise<Response> {
  const resumePayload = parseResumePayloadFromUrl(c.req.raw.url);
  if (!resumePayload) {
    return c.json({ ok: false, error: { code: "INVALID_QUERY", message: "sessionId and remoteRunId are required." } }, 400);
  }

  if (options.replayProvider) {
    return createReplayResponse({
      replayProvider: options.replayProvider,
      payload: resumePayload,
      signal: c.req.raw.signal,
    });
  }

  return createForwardResponse({
    endpoint: options.agentEndpoint,
    requestEvent: { type: "message.resume-request", payload: resumePayload },
    requestSignal: c.req.raw.signal,
    timeoutMs: options.timeoutMs,
    scope: {
      sessionId: resumePayload.sessionId,
      runId: resumePayload.remoteRunId,
    },
  });
}

export async function handleAbort(c: Context, options: RouteHandlerOptions): Promise<Response> {
  const payload = await parseAbortPayload(c.req.raw);
  await options.agentEndpoint.emit({ type: "message.abort", payload });
  return c.json({ ok: true });
}
