import type { AppEvent as KernelAppEvent } from '@nextclaw/shared';

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestInput = {
  method: RequestMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type StreamEvent = {
  name: string;
  payload?: unknown;
};

export type StreamInput = {
  method: Extract<RequestMethod, 'GET' | 'POST'>;
  path: string;
  body?: unknown;
  signal?: AbortSignal;
  onEvent: (event: StreamEvent) => void;
};

export type StreamSession<TFinal = unknown> = {
  finished: Promise<TFinal>;
  cancel: () => void;
};

export type AppEvent =
  | KernelAppEvent
  | { type: 'connection.open'; payload?: Record<string, never> }
  | { type: 'connection.close'; payload?: Record<string, never> }
  | { type: 'connection.error'; payload?: { message?: string } };

export type AppTransport = {
  request<T>(input: RequestInput): Promise<T>;
  openStream<TFinal = unknown>(input: StreamInput): StreamSession<TFinal>;
  subscribe(handler: (event: AppEvent) => void): () => void;
};

export type RemoteRuntimeInfo = {
  mode: 'remote';
  protocolVersion: 1;
  wsPath: string;
};
