import type {
  NcpAgentServerEndpoint,
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
  endpoint: NcpAgentServerEndpoint;
  requestEvent: NcpEndpointEvent;
  requestSignal: AbortSignal;
  timeoutMs: number;
  scope: EventScope;
};

export function createForwardResponse(options: ForwardResponseOptions): Response {
  const { requestSignal } = options;
  return buildSseResponse(
    createSseEventStream(createForwardSseEvents(options), requestSignal),
  );
}

async function* createForwardSseEvents(options: ForwardResponseOptions): AsyncGenerator<SseEventFrame> {
  const { endpoint, requestEvent, requestSignal, timeoutMs, scope } = options;
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
    requestSignal.removeEventListener("abort", stop);
    queue.close();
  };

  requestSignal.addEventListener("abort", stop, { once: true });
  timeoutId = setTimeout(() => {
    push(toErrorFrame("TIMEOUT", "NCP HTTP stream timed out before terminal event."));
    stop();
  }, timeoutMs);

  unsubscribe = endpoint.subscribe((event) => {
    if (!matchesScope(scope, event)) {
      return;
    }
    push(toNcpEventFrame(event));
    if (isTerminalEvent(event)) {
      stop();
    }
  });

  void endpoint.emit(requestEvent).catch((error) => {
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
  const { signal } = options;
  return buildSseResponse(
    createSseEventStream(createReplaySseEvents(options), signal),
  );
}

async function* createReplaySseEvents(options: ReplayResponseOptions): AsyncGenerator<SseEventFrame> {
  const { replayProvider, payload, signal } = options;
  try {
    for await (const event of replayProvider.stream({ payload, signal })) {
      if (signal.aborted) {
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
