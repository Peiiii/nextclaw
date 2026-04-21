import type { WsEvent } from '@/api/types';

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestInput = {
  method: RequestMethod;
  path: string;
  body?: unknown;
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

export type AppEvent = WsEvent;

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
