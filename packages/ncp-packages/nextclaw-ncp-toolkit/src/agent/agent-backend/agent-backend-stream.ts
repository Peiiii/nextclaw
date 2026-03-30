import type {
  NcpAgentRunStreamOptions,
  NcpEndpointEvent,
  NcpStreamRequestPayload,
} from "@nextclaw/ncp";
import { createAsyncQueue } from "./async-queue.js";
import type { AgentLiveSessionRegistry } from "./agent-live-session-registry.js";
import { isTerminalEvent } from "./agent-backend-session-utils.js";

export async function* streamAgentBackendExecution(params: {
  payloadOrParams:
    | NcpStreamRequestPayload
    | { payload: NcpStreamRequestPayload; signal: AbortSignal };
  opts?: NcpAgentRunStreamOptions;
  sessionRegistry: AgentLiveSessionRegistry;
}): AsyncIterable<NcpEndpointEvent> {
  const payload =
    "payload" in params.payloadOrParams && "signal" in params.payloadOrParams
      ? params.payloadOrParams.payload
      : params.payloadOrParams;
  const signal =
    "payload" in params.payloadOrParams && "signal" in params.payloadOrParams
      ? params.payloadOrParams.signal
      : params.opts?.signal ?? new AbortController().signal;

  const session = params.sessionRegistry.getSession(payload.sessionId);
  const execution = session?.activeExecution;
  if (!session || !execution || execution.closed) {
    return;
  }

  const queue = createAsyncQueue<NcpEndpointEvent>();
  const unsubscribe = execution.publisher.subscribe((event) => {
    queue.push(event);
  });
  const unsubscribeClose = execution.publisher.onClose(() => {
    queue.close();
  });
  const stop = () => {
    unsubscribe();
    unsubscribeClose();
    queue.close();
    signal.removeEventListener("abort", stop);
  };

  signal.addEventListener("abort", stop, { once: true });

  try {
    for await (const event of queue.iterable) {
      if (signal.aborted) {
        break;
      }
      yield event;
      if (isTerminalEvent(event)) {
        break;
      }
    }
  } finally {
    stop();
  }
}
