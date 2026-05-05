import type { NextClawSessionSummary } from "./session.types.js";

export type NextClawRealtimeEvent =
  | { type: "config.updated"; payload: { path: string } }
  | {
      type: "channel.config.apply-status";
      payload: { channel: string; status: "started" | "succeeded" | "failed"; message?: string };
    }
  | { type: "session.updated"; payload: { sessionKey: string } }
  | { type: "session.run-status"; payload: { sessionKey: string; status: "running" | "idle" } }
  | { type: "session.summary.upsert"; payload: { summary: NextClawSessionSummary } }
  | { type: "session.summary.delete"; payload: { sessionKey: string } }
  | { type: "config.reload.started"; payload?: Record<string, unknown> }
  | { type: "config.reload.finished"; payload?: Record<string, unknown> }
  | { type: "error"; payload: { message: string; code?: string } }
  | { type: "connection.open"; payload?: Record<string, unknown> }
  | { type: "connection.close"; payload?: Record<string, unknown> }
  | { type: "connection.error"; payload?: { message?: string } };

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
