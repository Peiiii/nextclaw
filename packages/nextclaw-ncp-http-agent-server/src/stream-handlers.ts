import type {
  NcpAgentEndpoint,
  NcpEndpointEvent,
  NcpResumeRequestPayload,
} from "@nextclaw/ncp";
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
  SseEventFrame,
} from "./types.js";
import { createAsyncQueue } from "./async-queue.js";
import { errorMessage } from "./utils.js";

export type ForwardResponseOptions = {
  endpoint: NcpAgentEndpoint;
  requestEvent: NcpEndpointEvent;
  requestSignal: AbortSignal;
  timeoutMs: number;
  scope: EventScope;
};

export function createForwardResponse(options: ForwardResponseOptions): Response {
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

export type ReplayResponseOptions = {
  replayProvider: NcpHttpAgentReplayProvider;
  payload: NcpResumeRequestPayload;
  signal: AbortSignal;
};

export function createReplayResponse(options: ReplayResponseOptions): Response {
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
