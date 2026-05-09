export type EventKey<T> = {
  readonly id: string;
  readonly _type?: T;
};

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

export type AppEventKey<T> = EventKey<T>;
export type AppEventSource = EventSource;
export type AppEventEnvelope<T = unknown> = EventEnvelope<T>;
export type AppEventEmitOptions = EventEmitOptions;
export type AppEventHandler<T> = EventHandler<T>;
export type AppEvent = AppEventEnvelope;
