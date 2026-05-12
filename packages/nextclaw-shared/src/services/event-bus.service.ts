import type {
  AppEventEmitOptions,
  AppEventEnvelope,
  AppEventHandler,
  AppEventKey,
  EventBusOptions,
  Unsubscribe,
} from "../types/event-bus.types.js";
import { getKeyId, type Key } from "../types/typed-key.types.js";

export class EventBus {
  private readonly listeners = new Map<string, Set<AppEventHandler<unknown>>>();
  private readonly globalListeners = new Set<(event: AppEventEnvelope) => void>();
  private listenerCount = 0;
  private readonly onFirstSubscriber?: EventBusOptions["onFirstSubscriber"];
  private readonly onListenerError?: EventBusOptions["onListenerError"];
  private readonly onNoSubscribers?: EventBusOptions["onNoSubscribers"];

  constructor(options: EventBusOptions = {}) {
    this.onFirstSubscriber = options.onFirstSubscriber;
    this.onListenerError = options.onListenerError;
    this.onNoSubscribers = options.onNoSubscribers;
  }

  emit = <T>(
    key: Key<T>,
    payload: T,
    options: AppEventEmitOptions = {},
  ): void => {
    const envelope: AppEventEnvelope<T> = {
      type: getKeyId(key),
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

  on = <T>(key: AppEventKey<T>, handler: AppEventHandler<T>): Unsubscribe => {
    const keyId = getKeyId(key);
    const listeners = this.listeners.get(keyId) ?? new Set<AppEventHandler<unknown>>();
    const typedHandler = handler as AppEventHandler<unknown>;
    const added = !listeners.has(typedHandler);
    listeners.add(typedHandler);
    this.listeners.set(keyId, listeners);
    if (added) {
      this.registerSubscriber();
    }
    return () => {
      this.off(key, handler);
    };
  };

  off = <T>(key: AppEventKey<T>, handler: AppEventHandler<T>): void => {
    const keyId = getKeyId(key);
    const listeners = this.listeners.get(keyId);
    if (!listeners) {
      return;
    }
    const deleted = listeners.delete(handler as AppEventHandler<unknown>);
    if (listeners.size === 0) {
      this.listeners.delete(keyId);
    }
    if (deleted) {
      this.unregisterSubscriber();
    }
  };

  once = <T>(key: AppEventKey<T>, handler: AppEventHandler<T>): Unsubscribe => {
    const wrappedHandler: AppEventHandler<T> = (payload, envelope) => {
      unsubscribe();
      handler(payload, envelope);
    };
    const unsubscribe = this.on(key, wrappedHandler);
    return unsubscribe;
  };

  subscribeAll = (handler: (event: AppEventEnvelope) => void): Unsubscribe => {
    const added = !this.globalListeners.has(handler);
    this.globalListeners.add(handler);
    if (added) {
      this.registerSubscriber();
    }
    return () => {
      if (this.globalListeners.delete(handler)) {
        this.unregisterSubscriber();
      }
    };
  };

  private registerSubscriber = (): void => {
    this.listenerCount += 1;
    if (this.listenerCount === 1) {
      this.onFirstSubscriber?.();
    }
  };

  private unregisterSubscriber = (): void => {
    this.listenerCount = Math.max(0, this.listenerCount - 1);
    if (this.listenerCount === 0) {
      this.onNoSubscribers?.();
    }
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
