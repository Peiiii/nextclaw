import type { NextClawRealtimeEvent } from "./nextclaw-realtime.types.js";

export type NextClawRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type NextClawQueryValue = string | number | boolean | null | undefined;

export type NextClawQueryParams =
  | URLSearchParams
  | Record<string, NextClawQueryValue | readonly NextClawQueryValue[]>;

export type NextClawTransportRequestInput = {
  method: NextClawRequestMethod;
  path: string;
  body?: unknown;
  query?: NextClawQueryParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type NextClawTransportUploadInput = {
  path: string;
  formData: FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type NextClawTransport = {
  request<T>(input: NextClawTransportRequestInput): Promise<T>;
  upload?<T>(input: NextClawTransportUploadInput): Promise<T>;
  subscribe?(handler: (event: NextClawRealtimeEvent) => void): () => void;
};
