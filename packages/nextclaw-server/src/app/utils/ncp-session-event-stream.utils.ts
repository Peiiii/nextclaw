import type { NcpEndpointEvent, NcpStreamRequestPayload } from "@nextclaw/ncp";
import { eventKeys, type EventBus, type Unsubscribe } from "@nextclaw/shared";

function readEventSessionId(event: NcpEndpointEvent): string | null {
  const payload = "payload" in event ? event.payload : null;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return "sessionId" in payload && typeof payload.sessionId === "string"
    ? payload.sessionId
    : null;
}

function toSseFrame(eventName: string, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createNcpSessionEventStreamResponse(
  eventBus: Pick<EventBus, "on">,
  payload: NcpStreamRequestPayload,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let unsubscribe: Unsubscribe = () => undefined;
  const cleanup = () => {
    unsubscribe();
    signal.removeEventListener("abort", close);
  };
  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    cleanup();
    controller?.close();
  };
  const push = (event: NcpEndpointEvent) => {
    if (closed || signal.aborted) {
      return;
    }
    if (readEventSessionId(event) === payload.sessionId) {
      controller?.enqueue(encoder.encode(toSseFrame("ncp-event", event)));
    }
  };
  const stream = new ReadableStream<Uint8Array>({
    start: (streamController) => {
      controller = streamController;
      unsubscribe = eventBus.on(eventKeys.ncpEvent, push);
      signal.addEventListener("abort", close, { once: true });
      if (signal.aborted) {
        close();
      }
    },
    cancel: () => {
      if (!closed) {
        closed = true;
        cleanup();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
