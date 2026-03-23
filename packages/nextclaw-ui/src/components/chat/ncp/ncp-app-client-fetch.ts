import { API_BASE } from '@/api/api-base';
import { appClient } from '@/transport';

type FetchLike = typeof fetch;

export function createNcpAppClientFetch(): FetchLike {
  return async (input, init) => {
    const request = toRequestSnapshot(input, init);
    if (isSseRequest(request)) {
      return createSseResponse(request);
    }

    try {
      const data = await appClient.request<unknown>({
        method: request.method,
        path: request.path,
        ...(request.body !== undefined ? { body: request.body } : {})
      });
      return new Response(JSON.stringify(data ?? {}), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });
    } catch (error) {
      return new Response(error instanceof Error ? error.message : String(error), {
        status: 500,
        headers: {
          'content-type': 'text/plain; charset=utf-8'
        }
      });
    }
  };
}

type RequestSnapshot = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  signal?: AbortSignal;
  headers: Headers;
};

function toRequestSnapshot(input: URL | string | Request, init?: RequestInit): RequestSnapshot {
  const request = input instanceof Request ? input : null;
  const url = new URL(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url,
    API_BASE
  );
  const headers = new Headers(init?.headers ?? request?.headers);
  const method = ((init?.method ?? request?.method ?? 'GET').toUpperCase()) as RequestSnapshot['method'];
  return {
    method,
    path: `${url.pathname}${url.search}`,
    body: parseRequestBody(init?.body),
    signal: init?.signal ?? request?.signal ?? undefined,
    headers
  };
}

function parseRequestBody(body: BodyInit | null | undefined): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

function isSseRequest(request: RequestSnapshot): boolean {
  const accept = request.headers.get('accept')?.toLowerCase() ?? '';
  return accept.includes('text/event-stream');
}

function createSseResponse(request: RequestSnapshot): Response {
  const encoder = new TextEncoder();
  let session: ReturnType<typeof appClient.openStream<unknown>> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      session = appClient.openStream<unknown>({
        method: request.method === 'GET' ? 'GET' : 'POST',
        path: request.path,
        ...(request.body !== undefined ? { body: request.body } : {}),
        signal: request.signal,
        onEvent: (event) => {
          controller.enqueue(encoder.encode(encodeSseFrame(event.name, event.payload)));
        }
      });

      void session.finished
        .then(() => {
          controller.close();
        })
        .catch((error) => {
          controller.enqueue(encoder.encode(encodeSseFrame('error', {
            message: error instanceof Error ? error.message : String(error)
          })));
          controller.close();
        });
    },
    cancel() {
      session?.cancel();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream'
    }
  });
}

function encodeSseFrame(event: string, payload: unknown): string {
  const data = payload === undefined ? '' : JSON.stringify(payload);
  return `event: ${event}\ndata: ${data}\n\n`;
}
