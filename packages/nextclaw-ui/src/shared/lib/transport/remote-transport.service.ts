import { API_BASE } from '@/api/api-base';
import type { ApiError } from '@/api/types';
import type { AppEvent, AppTransport, RemoteRuntimeInfo, RequestInput, StreamInput, StreamSession } from './transport.types';
import { resolveTransportWebSocketUrl } from './transport-websocket-url.utils';

type RemoteTarget = {
  method: string;
  path: string;
  body?: unknown;
};

type RemoteBrowserFrame =
  | { type: 'connection.ready'; connectionId: string; protocolVersion: 1 }
  | { type: 'response'; id: string; status: number; body?: unknown }
  | { type: 'request.error'; id: string; message: string; code?: string }
  | { type: 'stream.event'; streamId: string; event: string; payload?: unknown }
  | { type: 'stream.end'; streamId: string }
  | { type: 'stream.error'; streamId: string; message: string; code?: string }
  | { type: 'event'; event: AppEvent }
  | { type: 'connection.error'; message: string; code?: string };

type RemoteBrowserCommand =
  | { type: 'request'; id: string; target: RemoteTarget }
  | { type: 'stream.open'; streamId: string; target: RemoteTarget }
  | { type: 'stream.cancel'; streamId: string };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

type PendingStream = {
  onEvent: StreamInput['onEvent'];
  finalResult: unknown;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

function normalizeApiError(body: unknown, status: number, fallback: string): Error {
  if (typeof body === 'object' && body && 'ok' in body) {
    const typed = body as { ok?: boolean; error?: ApiError; data?: unknown };
    if (typed.ok === false && typed.error?.message) {
      return new Error(typed.error.message);
    }
    if (typed.ok === true) {
      return new Error(fallback);
    }
  }
  if (typeof body === 'string' && body.trim()) {
    return new Error(body.trim());
  }
  return new Error(`${fallback} (${status})`);
}

function unwrapApiBody<T>(body: unknown): T {
  if (typeof body === 'object' && body && 'ok' in body) {
    const typed = body as { ok?: boolean; error?: ApiError; data?: T };
    if (typed.ok === false) {
      throw new Error(typed.error?.message ?? 'Remote request failed.');
    }
    if (typed.ok === true) {
      return typed.data as T;
    }
  }
  return body as T;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const REMOTE_REQUEST_TIMEOUT_MS = 15_000;

export class RemoteSessionMultiplexTransport implements AppTransport {
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private connectTimeoutId: number | null = null;
  private reconnectTimer: number | null = null;
  private manualClose = false;
  private subscribers = new Set<(event: AppEvent) => void>();
  private pendingRequests = new Map<string, PendingRequest>();
  private pendingStreams = new Map<string, PendingStream>();

  constructor(
    private readonly runtime: RemoteRuntimeInfo,
    private readonly apiBase: string = API_BASE
  ) {}

  request = async <T>(input: RequestInput): Promise<T> => {
    await this.ensureSocket();
    const id = createId('req');
    const timeoutMs = Number.isFinite(input.timeoutMs) && (input.timeoutMs ?? 0) > 0
      ? Math.trunc(input.timeoutMs as number)
      : REMOTE_REQUEST_TIMEOUT_MS;
    return await new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timed out waiting for remote request response after ${timeoutMs}ms: ${input.method} ${input.path}`));
      }, timeoutMs);
      this.pendingRequests.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeoutId
      });
      this.send({
        type: 'request',
        id,
        target: {
          method: input.method,
          path: input.path,
          ...(input.body !== undefined ? { body: input.body } : {})
        }
      });
    });
  }

  openStream = <TFinal = unknown>(input: StreamInput): StreamSession<TFinal> => {
    const streamId = createId('stream');
    let settled = false;
    const rejectEarly = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    let resolve!: (value: TFinal) => void;
    let reject!: (error: Error) => void;
    const finished = new Promise<TFinal>((innerResolve, innerReject) => {
      resolve = innerResolve;
      reject = innerReject;
    });

    const cancel = () => {
      this.pendingStreams.delete(streamId);
      if (settled) {
        return;
      }
      settled = true;
      this.send({ type: 'stream.cancel', streamId });
      reject(new Error('stream cancelled'));
    };

    this.pendingStreams.set(streamId, {
      onEvent: input.onEvent,
      finalResult: undefined,
      resolve: (value) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value as TFinal);
      },
      reject: (error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      }
    });

    const abort = () => cancel();
    if (input.signal) {
      if (input.signal.aborted) {
        cancel();
      } else {
        input.signal.addEventListener('abort', abort, { once: true });
      }
    }

    void this.ensureSocket()
      .then(() => {
        if (settled) {
          return;
        }
        this.send({
          type: 'stream.open',
          streamId,
          target: {
            method: input.method,
            path: input.path,
            ...(input.body !== undefined ? { body: input.body } : {})
          }
        });
      })
      .catch((error) => {
        this.pendingStreams.delete(streamId);
        rejectEarly(error instanceof Error ? error : new Error(String(error)));
      });

    return {
      finished: finished.finally(() => {
        input.signal?.removeEventListener('abort', abort);
        this.pendingStreams.delete(streamId);
      }),
      cancel
    };
  }

  subscribe = (handler: (event: AppEvent) => void): () => void => {
    this.subscribers.add(handler);
    void this.ensureSocket().catch((error) => {
      handler({
        type: 'connection.error',
        payload: { message: error instanceof Error ? error.message : String(error) }
      });
    });
    return () => {
      this.subscribers.delete(handler);
    };
  }

  private emit = (event: AppEvent): void => {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  private send = (frame: RemoteBrowserCommand): void => {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Remote transport websocket is not connected.');
    }
    this.socket.send(JSON.stringify(frame));
  }

  private ensureSocket = async (): Promise<void> => {
    if (this.socket?.readyState === WebSocket.OPEN && this.connectPromise === null) {
      return;
    }
    if (this.connectPromise) {
      return await this.connectPromise;
    }

    const wsUrl = resolveTransportWebSocketUrl(this.apiBase, this.runtime.wsPath);
    this.manualClose = false;
    this.connectPromise = new Promise<void>((innerResolve, innerReject) => {
        const socket = new WebSocket(wsUrl);
        this.socket = socket;
        let connectionOpened = false;

        const clearConnectTimeout = () => {
          if (this.connectTimeoutId !== null) {
            window.clearTimeout(this.connectTimeoutId);
            this.connectTimeoutId = null;
          }
        };

        this.connectTimeoutId = window.setTimeout(() => {
          this.connectTimeoutId = null;
          innerReject(new Error('Timed out waiting for remote transport websocket.'));
          socket.close();
        }, 8_000);

        socket.onopen = () => {
          connectionOpened = true;
          clearConnectTimeout();
          this.connectPromise = null;
          innerResolve();
          this.emit({ type: 'connection.open', payload: {} });
        };

        socket.onmessage = (event) => {
          try {
            const frame = JSON.parse(String(event.data ?? '')) as RemoteBrowserFrame;
            if (frame.type === 'connection.ready') {
              return;
            }
            this.handleFrame(frame);
          } catch (error) {
            console.error('Failed to parse remote websocket frame:', error);
          }
        };

        socket.onerror = () => {
          this.emit({ type: 'connection.error', payload: { message: 'remote websocket error' } });
        };

        socket.onclose = () => {
          clearConnectTimeout();
          const wasConnecting = this.connectPromise !== null;
          this.socket = null;
          this.connectPromise = null;
          this.failPendingWork(new Error('Remote transport connection closed.'));
          this.emit({ type: 'connection.close', payload: {} });
          if (wasConnecting && !connectionOpened) {
            innerReject(new Error('Remote transport connection closed before ready.'));
          }
          if (!this.manualClose && this.subscribers.size > 0) {
            this.scheduleReconnect();
          }
        };
      });

    const connectPromise = this.connectPromise;
    return await connectPromise;
  }

  private scheduleReconnect = (): void => {
    if (this.reconnectTimer !== null) {
      return;
    }
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureSocket().catch(() => undefined);
    }, 3_000);
  }

  private failPendingWork = (error: Error): void => {
    for (const pending of this.pendingRequests.values()) {
      window.clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pendingRequests.clear();

    for (const pending of this.pendingStreams.values()) {
      pending.reject(error);
    }
    this.pendingStreams.clear();
  }

  private handleFrame = (frame: RemoteBrowserFrame): void => {
    if (frame.type === 'response' || frame.type === 'request.error') {
      this.handleRequestFrame(frame);
      return;
    }
    if (frame.type === 'stream.event' || frame.type === 'stream.end' || frame.type === 'stream.error') {
      this.handleStreamFrame(frame);
      return;
    }
    if (frame.type === 'event') {
      this.emit(frame.event);
      return;
    }
    if (frame.type === 'connection.error') {
      this.emit({ type: 'connection.error', payload: { message: frame.message } });
    }
  }

  private handleRequestFrame = (frame: Extract<RemoteBrowserFrame, { type: 'response' | 'request.error' }>): void => {
    const pending = this.pendingRequests.get(frame.id);
    if (!pending) {
      return;
    }
    this.pendingRequests.delete(frame.id);
    window.clearTimeout(pending.timeoutId);
    if (frame.type === 'request.error') {
      pending.reject(new Error(frame.message));
      return;
    }
    if (frame.status >= 400) {
      pending.reject(normalizeApiError(frame.body, frame.status, 'Remote request failed.'));
      return;
    }
    try {
      pending.resolve(unwrapApiBody(frame.body));
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleStreamFrame = (frame: Extract<RemoteBrowserFrame, { type: 'stream.event' | 'stream.end' | 'stream.error' }>): void => {
    const pending = this.pendingStreams.get(frame.streamId);
    if (!pending) {
      return;
    }
    if (frame.type === 'stream.event') {
      try {
        if (frame.event === 'final') {
          pending.finalResult = frame.payload;
        }
        pending.onEvent({ name: frame.event, payload: frame.payload });
      } catch (error) {
        this.pendingStreams.delete(frame.streamId);
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }
    this.pendingStreams.delete(frame.streamId);
    if (frame.type === 'stream.end') {
      pending.resolve(pending.finalResult);
      return;
    }
    pending.reject(new Error(frame.message));
  }
}
