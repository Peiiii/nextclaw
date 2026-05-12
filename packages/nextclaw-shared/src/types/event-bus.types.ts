import type { Key, TypedKey } from "./typed-key.types.js";

export type EventKey<T> = TypedKey<T>;

export type EventSource = string;

export type EventEnvelope<T = unknown> = {
  type: string;
  payload: T;
  emittedAt?: string;
  source?: EventSource;
};

export type EventEmitOptions = {
  emittedAt?: string;
  source?: EventSource;
};

export type EventHandler<T> = (payload: T, envelope: EventEnvelope<T>) => void;

export type Unsubscribe = () => void;

export type EventBusOptions = {
  onFirstSubscriber?: () => void;
  onListenerError?: (params: {
    type: string;
    payload: unknown;
    error: unknown;
  }) => void;
  onNoSubscribers?: () => void;
};

export type AppEventKey<T> = Key<T>;
export type AppEventSource = EventSource;
export type AppEventEnvelope<T = unknown> = EventEnvelope<T>;
export type AppEventEmitOptions = EventEmitOptions;
export type AppEventHandler<T> = EventHandler<T>;
export type AppEvent = AppEventEnvelope;
