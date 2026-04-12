import { API_BASE } from '@/api/api-base';
import { requestRawApiResponse } from '@/api/raw-client';
import type { ApiResponse } from '@/api/types';
import type { AppEvent, AppTransport, RequestInput, StreamInput, StreamSession } from './transport.types';
import { readSseStreamResult } from './sse-stream';
import { resolveTransportWebSocketUrl } from './transport-websocket-url';

type EventHandler = (event: AppEvent) => void;

function createTransportError(response: ApiResponse<unknown>, fallback: string): Error {
  if (!response.ok) {
    return new Error(response.error.message);
  }
  return new Error(fallback);
}

function formatUnknownTransportError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name?.trim();
    const message = error.message?.trim();
    if (name && message) {
      return `${name}: ${message}`;
    }
    return message || name || 'Unknown error';
  }
  return String(error ?? 'Unknown error');
}

function createErrorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message) as Error & { cause?: unknown };
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}

class LocalRealtimeGateway {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private manualClose = false;
  private subscribers = new Set<EventHandler>();

  constructor(private readonly wsUrl: string) {}

  subscribe(handler: EventHandler): () => void {
    this.subscribers.add(handler);
    if (this.subscribers.size === 1) {
      this.connect();
    } else if (this.socket?.readyState === WebSocket.OPEN) {
      handler({ type: 'connection.open', payload: {} });
    }

    return () => {
      this.subscribers.delete(handler);
      if (this.subscribers.size === 0) {
        this.disconnect();
      }
    };
  }

  private emit(event: AppEvent): void {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  private connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      return;
    }
    this.manualClose = false;
    const socket = new WebSocket(this.wsUrl);
    this.socket = socket;

    socket.onopen = () => {
      this.emit({ type: 'connection.open', payload: {} });
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data ?? '')) as AppEvent;
        this.emit(data);
      } catch (error) {
        console.error('Failed to parse websocket message:', error);
      }
    };

    socket.onerror = () => {
      this.emit({ type: 'connection.error', payload: { message: 'websocket error' } });
    };

    socket.onclose = () => {
      this.emit({ type: 'connection.close', payload: {} });
      this.socket = null;
      if (!this.manualClose && this.subscribers.size > 0) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return;
    }
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3_000);
  }

  private disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }
}

export class LocalAppTransport implements AppTransport {
  private readonly realtimeGateway: LocalRealtimeGateway;
  private readonly apiBase: string;

  constructor(
    private readonly options: {
      apiBase?: string;
      wsPath?: string;
    } = {}
  ) {
    this.apiBase = options.apiBase ?? API_BASE;
    this.realtimeGateway = new LocalRealtimeGateway(resolveTransportWebSocketUrl(this.apiBase, options.wsPath ?? '/ws'));
  }

  request = async <T>(input: RequestInput): Promise<T> => {
    const timeoutMs = Number.isFinite(input.timeoutMs) && (input.timeoutMs ?? 0) > 0
      ? Math.trunc(input.timeoutMs as number)
      : null;
    const controller = timeoutMs ? new AbortController() : null;
    const timeoutId = timeoutMs
      ? window.setTimeout(() => controller?.abort(`Request timed out after ${timeoutMs}ms: ${input.method} ${input.path}`), timeoutMs)
      : null;

    try {
      const response = await requestRawApiResponse<T>(input.path, {
        method: input.method,
        ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
        ...(controller ? { signal: controller.signal } : {})
      });
      if (!response.ok) {
        throw createTransportError(response, `Request failed for ${input.method} ${input.path}`);
      }
      return response.data;
    } catch (error) {
      if (controller?.signal.aborted) {
        const reason = controller.signal.reason;
        throw new Error(typeof reason === 'string' && reason.trim() ? reason : `Request timed out: ${input.method} ${input.path}`);
      }
      if (error instanceof Error) {
        throw error;
      }
      throw createErrorWithCause(
        `Request failed for ${input.method} ${input.path} | ${formatUnknownTransportError(error)}`,
        error
      );
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    }
  };

  openStream = <TFinal = unknown>(input: StreamInput): StreamSession<TFinal> => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (input.signal) {
      if (input.signal.aborted) {
        abort();
      } else {
        input.signal.addEventListener('abort', abort, { once: true });
      }
    }

    const finished = (async () => {
      let response: Response;
      try {
        response = await fetch(`${this.apiBase}${input.path}`, {
          method: input.method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream'
          },
          ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
          signal: controller.signal
        });
      } catch (error) {
        throw createErrorWithCause(
          `Stream request failed for ${input.method} ${input.path} | ${formatUnknownTransportError(error)}`,
          error
        );
      }

      if (!response.ok) {
        const text = await response.text();
        const body = text.trim();
        throw new Error(
          body
            ? `Stream request failed for ${input.method} ${input.path} | HTTP ${response.status} | ${body}`
            : `Stream request failed for ${input.method} ${input.path} | HTTP ${response.status}`
        );
      }
      try {
        return await readSseStreamResult<TFinal>(response, input.onEvent);
      } finally {
        input.signal?.removeEventListener('abort', abort);
      }
    })();

    return {
      finished,
      cancel: () => controller.abort()
    };
  };

  subscribe = (handler: (event: AppEvent) => void): () => void => {
    return this.realtimeGateway.subscribe(handler);
  };
}
