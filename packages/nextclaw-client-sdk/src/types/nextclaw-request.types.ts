import type { NextClawRealtimeEvent, NextClawWebSocketLike } from "./nextclaw-realtime.types.js";
import type {
  NextClawQueryParams,
  NextClawRequestMethod,
  NextClawTransport
} from "./nextclaw-transport.types.js";

export type NextClawClientOptions = {
  baseUrl: string;
  transport?: NextClawTransport;
  headers?: Record<string, string>;
  token?: string;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (url: string) => NextClawWebSocketLike;
};

export type NextClawRequestOptions = {
  method?: NextClawRequestMethod;
  body?: unknown;
  query?: NextClawQueryParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type NextClawUploadOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type NextClawRealtimeSubscribeOptions = {
  reconnectDelayMs?: number;
  onError?: (error: unknown) => void;
};

export type NextClawRealtimeHandler = (event: NextClawRealtimeEvent) => void;
