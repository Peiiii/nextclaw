import type { NextClawRealtimeEvent, NextClawWebSocketLike } from "./realtime.types.js";

export type NextClawClientOptions = {
  baseUrl: string;
  headers?: Record<string, string>;
  token?: string;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (url: string) => NextClawWebSocketLike;
};

export type NextClawRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type NextClawRealtimeSubscribeOptions = {
  reconnectDelayMs?: number;
  onError?: (error: unknown) => void;
};

export type NextClawRealtimeHandler = (event: NextClawRealtimeEvent) => void;
