import type { AppEvent } from "@nextclaw/kernel";

export type NextClawConnectionEvent =
  | { type: "connection.open"; payload?: Record<string, never> }
  | { type: "connection.close"; payload?: Record<string, never> }
  | { type: "connection.error"; payload?: { message?: string } };

export type NextClawRealtimeEvent = AppEvent | NextClawConnectionEvent;

export type NextClawWebSocketLike = {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data?: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  close: (code?: number, reason?: string) => void;
};

export type NextClawRealtimeSubscription = {
  close: () => void;
};
