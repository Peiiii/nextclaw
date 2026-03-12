import { Hono } from "hono";
import type {
  NcpAgentEndpoint,
  NcpEndpointEvent,
  NcpResumeRequestPayload,
} from "@nextclaw/ncp";
import {
  normalizeBasePath,
  parseAbortPayload,
  parseRequestEnvelope,
  parseResumePayloadFromUrl,
  sanitizeTimeout,
} from "./parsers.js";
import { isTerminalEvent, matchesScope } from "./scope.js";
import {
  buildSseResponse,
  createSseEventStream,
  toErrorFrame,
  toNcpEventFrame,
} from "./sse-stream.js";
import type {
  EventScope,
  NcpHttpAgentReplayProvider,
  NcpHttpAgentServerOptions,
  SseEventFrame,
} from "./types.js";
import { createAsyncQueue } from "./async-queue.js";
import { errorMessage } from "./utils.js";

export function createNcpHttpAgentRouter(options: NcpHttpAgentServerOptions): Hono {
  const app = new Hono();
  mountNcpHttpAgentRoutes(app, options);
  return app;
}

export function mountNcpHttpAgentRoutes(app: Hono, options: NcpHttpAgentServerOptions): void {
  const basePath = normalizeBasePath(options.basePath);
  const timeoutMs = sanitizeTimeout(options.requestTimeoutMs);

  app.post(`${basePath}/send`, async (c) => {
    const envelope = await parseRequestEnvelope(c.req.raw);
    if (!envelope) {
      return c.json({ ok: false, error: { code: "INVALID_BODY", message: "Invalid NCP request envelope." } }, 400);
    }

    return createForwardResponse({
      endpoint: options.agentEndpoint,
      requestEvent: { type: "message.request", payload: envelope },
      requestSignal: c.req.raw.signal,
      timeoutMs,
      scope: {
        sessionId: envelope.sessionId,
        correlationId: envelope.correlationId,
      },
    });
  });

  app.get(`${basePath}/reconnect`, async (c) => {
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
      timeoutMs,
      scope: {
        sessionId: resumePayload.sessionId,
        runId: resumePayload.remoteRunId,
      },
    });
  });

  app.post(`${basePath}/abort`, async (c) => {
    const payload = await parseAbortPayload(c.req.raw);
    await options.agentEndpoint.emit({ type: "message.abort", payload });
    return c.json({ ok: true });
  });
}

type ForwardResponseOptions = {
  endpoint: NcpAgentEndpoint;
  requestEvent: NcpEndpointEvent;
  requestSignal: AbortSignal;
  timeoutMs: number;
  scope: EventScope;
};

function createForwardResponse(options: ForwardResponseOptions): Response {
  return buildSseResponse(
    createSseEventStream(createForwardSseEvents(options), options.requestSignal),
  );
}

async function* createForwardSseEvents(options: ForwardResponseOptions): AsyncGenerator<SseEventFrame> {
  const queue = createAsyncQueue<SseEventFrame>();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;
  let stopped = false;

  const push = (frame: SseEventFrame) => {
    if (!stopped) {
      queue.push(frame);
    }
  };

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    options.requestSignal.removeEventListener("abort", stop);
    queue.close();
  };

  options.requestSignal.addEventListener("abort", stop, { once: true });
  timeoutId = setTimeout(() => {
    push(toErrorFrame("TIMEOUT", "NCP HTTP stream timed out before terminal event."));
    stop();
  }, options.timeoutMs);

  unsubscribe = options.endpoint.subscribe((event) => {
    if (!matchesScope(options.scope, event)) {
      return;
    }
    push(toNcpEventFrame(event));
    if (isTerminalEvent(event)) {
      stop();
    }
  });

  void options.endpoint.emit(options.requestEvent).catch((error) => {
    push(toErrorFrame("EMIT_FAILED", errorMessage(error)));
    stop();
  });

  try {
    for await (const frame of queue.iterable) {
      yield frame;
    }
  } finally {
    stop();
  }
}

type ReplayResponseOptions = {
  replayProvider: NcpHttpAgentReplayProvider;
  payload: NcpResumeRequestPayload;
  signal: AbortSignal;
};

function createReplayResponse(options: ReplayResponseOptions): Response {
  return buildSseResponse(
    createSseEventStream(createReplaySseEvents(options), options.signal),
  );
}

async function* createReplaySseEvents(options: ReplayResponseOptions): AsyncGenerator<SseEventFrame> {
  try {
    for await (const event of options.replayProvider.stream({
      payload: options.payload,
      signal: options.signal,
    })) {
      if (options.signal.aborted) {
        break;
      }
      yield toNcpEventFrame(event);
      if (isTerminalEvent(event)) {
        break;
      }
    }
  } catch (error) {
    yield toErrorFrame("REPLAY_FAILED", errorMessage(error));
  }
}
