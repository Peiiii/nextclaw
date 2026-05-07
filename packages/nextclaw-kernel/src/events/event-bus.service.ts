import type {
  AppEventEnvelope,
  AppEventEmitOptions,
  AppEventHandler,
  AppEventKey,
  EventBusOptions,
} from "./event-bus.types.js";

export class EventBus {
  private readonly listeners = new Map<string, Set<AppEventHandler<unknown>>>();
  private readonly globalListeners = new Set<(event: AppEventEnvelope) => void>();
  private readonly onListenerError?: EventBusOptions["onListenerError"];

  constructor(options: EventBusOptions = {}) {
    this.onListenerError = options.onListenerError;
  }

  emit = <T>(
    key: AppEventKey<T>,
    payload: T,
    options: AppEventEmitOptions = {},
  ): void => {
    const envelope: AppEventEnvelope<T> = {
      type: key.id,
      payload,
      ...(options.emittedAt ? { emittedAt: options.emittedAt } : {}),
      ...(options.source ? { source: options.source } : {}),
    };
    this.emitEnvelope(envelope);
  };

  emitEnvelope = <T>(event: AppEventEnvelope<T>): void => {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        this.safeInvokeListener(event, listener as AppEventHandler<T>);
      }
    }
    if (this.globalListeners.size === 0) {
      return;
    }
    for (const listener of this.globalListeners) {
      this.safeInvokeGlobalListener(event, listener);
    }
  };

  on = <T>(key: AppEventKey<T>, handler: AppEventHandler<T>): (() => void) => {
    const listeners = this.listeners.get(key.id) ?? new Set<AppEventHandler<unknown>>();
    listeners.add(handler as AppEventHandler<unknown>);
    this.listeners.set(key.id, listeners);
    return () => {
      this.off(key, handler);
    };
  };

  off = <T>(key: AppEventKey<T>, handler: AppEventHandler<T>): void => {
    const listeners = this.listeners.get(key.id);
    if (!listeners) {
      return;
    }
    listeners.delete(handler as AppEventHandler<unknown>);
    if (listeners.size === 0) {
      this.listeners.delete(key.id);
    }
  };

  once = <T>(key: AppEventKey<T>, handler: AppEventHandler<T>): (() => void) => {
    const wrappedHandler: AppEventHandler<T> = (payload, envelope) => {
      unsubscribe();
      handler(payload, envelope);
    };
    const unsubscribe = this.on(key, wrappedHandler);
    return unsubscribe;
  };

  subscribeAll = (handler: (event: AppEventEnvelope) => void): (() => void) => {
    this.globalListeners.add(handler);
    return () => {
      this.globalListeners.delete(handler);
    };
  };

  private safeInvokeListener = <T>(
    event: AppEventEnvelope<T>,
    listener: AppEventHandler<T>,
  ): void => {
    try {
      listener(event.payload, event);
    } catch (error) {
      this.onListenerError?.({
        type: event.type,
        payload: event.payload,
        error,
      });
    }
  };

  private safeInvokeGlobalListener = (
    event: AppEventEnvelope,
    listener: (event: AppEventEnvelope) => void,
  ): void => {
    try {
      listener(event);
    } catch (error) {
      this.onListenerError?.({
        type: event.type,
        payload: event.payload,
        error,
      });
    }
  };
}
