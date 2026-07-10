import {
  createNcpEndpointEvent,
  NcpEventType,
  type NcpEndpointEvent,
} from "@nextclaw/ncp";

export const NCP_RUNTIME_STREAM_RETRY_INITIAL_DELAY_MS = 2_000;
export const NCP_RUNTIME_STREAM_RETRY_MAX_DELAY_MS = 30_000;
export const NCP_RUNTIME_STREAM_RETRY_METADATA_TYPE = "retry";

export type NcpRuntimeStreamAttemptState = {
  messageId: string | null;
};

export type NcpRuntimeStreamFailure = {
  events: readonly (NcpEndpointEvent | null)[];
  error?: unknown;
};

export function createNcpRuntimeStreamAttemptState(): NcpRuntimeStreamAttemptState {
  return {
    messageId: null,
  };
}

export function observeNcpRuntimeStreamAttemptEvent(
  state: NcpRuntimeStreamAttemptState,
  event: NcpEndpointEvent,
): NcpRuntimeStreamAttemptState {
  let nextState = state;
  if ("payload" in event && "messageId" in event.payload && typeof event.payload.messageId === "string") {
    nextState = { ...nextState, messageId: event.payload.messageId };
  }
  return nextState;
}

export function shouldRetryNcpRuntimeStreamAttempt(params: {
  failure: NcpRuntimeStreamFailure;
  signal?: AbortSignal;
}): boolean {
  const { failure, signal } = params;
  return (
    signal?.aborted !== true &&
    isRetryableNcpRuntimeStreamFailure(failure)
  );
}

export function createNcpRuntimeStreamRetryEvents(params: {
  attempt: number;
  correlationId?: string;
  failure: NcpRuntimeStreamFailure;
  runId?: string;
  sessionId: string;
  state: NcpRuntimeStreamAttemptState;
}): NcpEndpointEvent[] {
  const { attempt, correlationId, failure, runId, sessionId, state } = params;
  const message = readNcpRuntimeStreamFailureReason(failure);
  const delayMs = getNcpRuntimeStreamRetryDelayMs(attempt);
  const metadataEvent = createNcpEndpointEvent({
    type: NcpEventType.RunMetadata,
    payload: {
      sessionId,
      messageId: state.messageId ?? undefined,
      runId,
      correlationId,
      metadata: {
        type: NCP_RUNTIME_STREAM_RETRY_METADATA_TYPE,
        attempt,
        message,
        action: undefined,
        next: Date.now() + delayMs,
      },
    },
  });
  return [metadataEvent];
}

export function getNcpRuntimeStreamRetryDelayMs(attempt: number): number {
  return Math.min(
    NCP_RUNTIME_STREAM_RETRY_INITIAL_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    NCP_RUNTIME_STREAM_RETRY_MAX_DELAY_MS,
  );
}

export function readNcpRuntimeStreamFailureReason(
  failure: NcpRuntimeStreamFailure,
): string {
  const eventReasons = failure.events
    .filter((event): event is NcpEndpointEvent => Boolean(event))
    .map(readNcpRuntimeStreamEventFailureReason)
    .filter(Boolean);
  if (eventReasons.length > 0) {
    return eventReasons.join("; ");
  }
  if (failure.error instanceof Error) {
    return failure.error.message;
  }
  return typeof failure.error === "string" ? failure.error : "Runtime stream failed.";
}

function readNcpRuntimeStreamEventFailureReason(event: NcpEndpointEvent): string {
  if (event.type === NcpEventType.RunError) {
    return event.payload.error ?? "";
  }
  if (event.type === NcpEventType.MessageFailed) {
    const code = event.payload.error?.code;
    const message = event.payload.error?.message ?? "";
    return code ? `${code}: ${message}` : message;
  }
  return "";
}

function isRetryableNcpRuntimeStreamFailure(failure: NcpRuntimeStreamFailure): boolean {
  const reason = readNcpRuntimeStreamFailureReason(failure).toLowerCase();
  if (!reason) {
    return false;
  }
  if (
    reason.includes("abort") ||
    reason.includes("cancel") ||
    reason.includes("user terminated") ||
    reason.includes("用户终止") ||
    reason.includes("用户取消")
  ) {
    return false;
  }
  return [
    "429",
    "503",
    "504",
    "closed before",
    "connection closed",
    "connection reset",
    "econnreset",
    "fetch failed",
    "network",
    "overloaded",
    "premature",
    "rate limit",
    "socket",
    "stream",
    "temporarily unavailable",
    "timed out",
    "timeout",
    "und_err_socket",
  ].some((marker) => reason.includes(marker));
}
