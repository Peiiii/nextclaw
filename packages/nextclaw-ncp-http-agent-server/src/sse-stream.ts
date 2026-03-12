import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type { SseEventFrame } from "./types.js";

export function createSseEventStream(
  events: AsyncIterable<SseEventFrame>,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start: async (controller) => {
      let closed = false;
      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        controller.close();
      };

      const onAbort = () => {
        close();
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        for await (const event of events) {
          if (closed || signal?.aborted) {
            break;
          }
          controller.enqueue(encoder.encode(toSseFrame(event.event, event.data)));
        }
      } finally {
        signal?.removeEventListener("abort", onAbort);
        close();
      }
    },
  });
}

export function buildSseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function toSseFrame(eventName: string, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function toNcpEventFrame(event: NcpEndpointEvent): SseEventFrame {
  return {
    event: "ncp-event",
    data: event,
  };
}

export function toErrorFrame(code: string, message: string): SseEventFrame {
  return {
    event: "error",
    data: {
      code,
      message,
    },
  };
}
