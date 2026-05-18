import type {
  NcpAgentClientEndpoint,
  NcpEndpointEvent,
  NcpStreamRequestPayload,
} from "@nextclaw/ncp";
import { matchesScope } from "./scope.js";
import {
  buildSseResponse,
  createSseEventStream,
  toErrorFrame,
  toNcpEventFrame,
} from "./sse-stream.js";
import type {
  EventScope,
  NcpHttpAgentStreamProvider,
  SseEventFrame,
} from "./types.js";
import { createAsyncQueue } from "./async-queue.js";
import { errorMessage } from "./utils.js";

/** Options for streaming a live response from the agent (forward path). */
export type ForwardResponseOptions = {
  endpoint: NcpAgentClientEndpoint;
  requestEvent: NcpEndpointEvent;
  requestSignal: AbortSignal;
  timeoutMs: number | null;
  scope: EventScope;
};

export function createForwardResponse(
  options: ForwardResponseOptions,
): Response {
  const { requestSignal } = options;
  return buildSseResponse(
    createSseEventStream(createForwardSseEvents(options), requestSignal),
  );
}

async function* createForwardSseEvents(
  options: ForwardResponseOptions,
): AsyncGenerator<SseEventFrame> {
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
  if (timeoutMs !== null) {
    timeoutId = setTimeout(() => {
      push(
        toErrorFrame(
          "TIMEOUT",
          "NCP HTTP stream timed out before terminal event.",
        ),
      );
      stop();
    }, timeoutMs);
  }

  unsubscribe = endpoint.subscribe((event) => {
    if (!matchesScope(scope, event)) {
      return;
    }
    push(toNcpEventFrame(event));
  });

  void endpoint
    .emit(requestEvent)
    .catch((error) => {
      push(toErrorFrame("EMIT_FAILED", errorMessage(error)));
      stop();
    })
    .finally(() => {
      if (!requestSignal.aborted) {
        queueMicrotask(stop);
      }
    });

  try {
    for await (const frame of queue.iterable) {
      yield frame;
    }
  } finally {
    stop();
  }
}

/** Live session stream path: read directly from streamProvider, no extra agent call. */
export type LiveStreamResponseOptions = {
  streamProvider: NcpHttpAgentStreamProvider;
  payload: NcpStreamRequestPayload;
  signal: AbortSignal;
};

export function createLiveStreamResponse(
  options: LiveStreamResponseOptions,
): Response {
  const { signal } = options;
  return buildSseResponse(
    createSseEventStream(createLiveStreamSseEvents(options), signal),
  );
}

async function* createLiveStreamSseEvents(
  options: LiveStreamResponseOptions,
): AsyncGenerator<SseEventFrame> {
  const { streamProvider, payload, signal } = options;
  try {
    for await (const event of streamProvider.stream({ payload, signal })) {
      if (signal.aborted) {
        break;
      }
      yield toNcpEventFrame(event);
    }
  } catch (error) {
    yield toErrorFrame("STREAM_SOURCE_FAILED", errorMessage(error));
  }
}
