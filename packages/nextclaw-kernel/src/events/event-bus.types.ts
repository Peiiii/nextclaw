import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { UpdateSnapshot } from "@kernel/types/update.types.js";

export type AppEventKey<T> = {
  readonly id: string;
  readonly _type?: T;
};

export type AppEventSource = "backend" | "realtime" | "local";

export type AppEventEnvelope<T = unknown> = {
  type: string;
  payload: T;
  emittedAt?: string;
  source?: AppEventSource;
};

export type AppEventEmitOptions = {
  emittedAt?: string;
  source?: AppEventSource;
};

export type AppEventHandler<T> = (payload: T, envelope: AppEventEnvelope<T>) => void;

export type EventBusOptions = {
  onFirstSubscriber?: () => void;
  onListenerError?: (params: {
    type: string;
    payload: unknown;
    error: unknown;
  }) => void;
  onNoSubscribers?: () => void;
};

export type ConfigUpdatedEvent = AppEventEnvelope<{ path: string }> & {
  type: "config.updated";
};

export type ChannelConfigApplyStatusEvent = AppEventEnvelope<{
  channel: string;
  status: "started" | "succeeded" | "failed";
  message?: string;
}> & {
  type: "channel.config.apply-status";
};

export type SessionUpdatedEvent = AppEventEnvelope<{ sessionKey: string }> & {
  type: "session.updated";
};

export type SessionRunStatusEvent = AppEventEnvelope<{
  sessionKey: string;
  status: "running" | "idle";
}> & {
  type: "session.run-status";
};

export type SessionSummaryUpsertEvent = AppEventEnvelope<{ summary: NcpSessionSummary }> & {
  type: "session.summary.upsert";
};

export type SessionSummaryDeleteEvent = AppEventEnvelope<{ sessionKey: string }> & {
  type: "session.summary.delete";
};

export type ConfigReloadStartedEvent = AppEventEnvelope<Record<string, unknown> | undefined> & {
  type: "config.reload.started";
};

export type ConfigReloadFinishedEvent = AppEventEnvelope<Record<string, unknown> | undefined> & {
  type: "config.reload.finished";
};

export type ErrorEvent = AppEventEnvelope<{ message: string; code?: string }> & {
  type: "error";
};

export type ConnectionOpenEvent = AppEventEnvelope<Record<string, never> | undefined> & {
  type: "connection.open";
};

export type ConnectionCloseEvent = AppEventEnvelope<Record<string, never> | undefined> & {
  type: "connection.close";
};

export type ConnectionErrorEvent = AppEventEnvelope<{ message?: string } | undefined> & {
  type: "connection.error";
};

export type RuntimeUpdateSnapshotEvent = AppEventEnvelope<UpdateSnapshot> & {
  type: "runtime.update.snapshot";
};

export type AppEvent =
  | ConfigUpdatedEvent
  | ChannelConfigApplyStatusEvent
  | SessionUpdatedEvent
  | SessionRunStatusEvent
  | SessionSummaryUpsertEvent
  | SessionSummaryDeleteEvent
  | ConfigReloadStartedEvent
  | ConfigReloadFinishedEvent
  | ErrorEvent
  | ConnectionOpenEvent
  | ConnectionCloseEvent
  | ConnectionErrorEvent
  | RuntimeUpdateSnapshotEvent;
