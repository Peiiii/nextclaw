import {
  type TypedEventKey,
  readTypedEventKeyId,
} from "./typed-event-key.types.js";

export type TypedEventHandler<T> = (payload: T) => void;

export type TypedEventEnvelope = {
  key: string;
  payload: unknown;
};

export type GlobalTypedEventBusOptions = {
  onListenerError?: (params: {
    key: string;
    payload: unknown;
    error: unknown;
  }) => void;
};

export class GlobalTypedEventBus {
  private readonly listeners = new Map<string, Set<TypedEventHandler<unknown>>>();
  private readonly globalListeners = new Set<(event: TypedEventEnvelope) => void>();
  private readonly onListenerError?: GlobalTypedEventBusOptions["onListenerError"];

  constructor(options: GlobalTypedEventBusOptions = {}) {
    this.onListenerError = options.onListenerError;
  }

  emit = <T>(key: TypedEventKey<T>, payload: T): void => {
    const eventKey = readTypedEventKeyId(key);
    const listeners = this.listeners.get(eventKey);
    if (listeners) {
      for (const listener of listeners) {
        this.safeInvokeListener(eventKey, payload, listener);
      }
    }
    if (this.globalListeners.size === 0) {
      return;
    }
    const envelope: TypedEventEnvelope = {
      key: eventKey,
      payload,
    };
    for (const listener of this.globalListeners) {
      this.safeInvokeGlobalListener(envelope, listener);
    }
  };

  on = <T>(key: TypedEventKey<T>, handler: TypedEventHandler<T>): (() => void) => {
    const eventKey = readTypedEventKeyId(key);
    const listeners =
      this.listeners.get(eventKey) ?? new Set<TypedEventHandler<unknown>>();
    listeners.add(handler as TypedEventHandler<unknown>);
    this.listeners.set(eventKey, listeners);
    return () => {
      this.off(key, handler);
    };
  };

  off = <T>(key: TypedEventKey<T>, handler: TypedEventHandler<T>): void => {
    const eventKey = readTypedEventKeyId(key);
    const listeners = this.listeners.get(eventKey);
    if (!listeners) {
      return;
    }
    listeners.delete(handler as TypedEventHandler<unknown>);
    if (listeners.size === 0) {
      this.listeners.delete(eventKey);
    }
  };

  once = <T>(key: TypedEventKey<T>, handler: TypedEventHandler<T>): (() => void) => {
    const wrappedHandler: TypedEventHandler<T> = (payload) => {
      unsubscribe();
      handler(payload);
    };
    const unsubscribe = this.on(key, wrappedHandler);
    return unsubscribe;
  };

  subscribeAll = (handler: (event: TypedEventEnvelope) => void): (() => void) => {
    this.globalListeners.add(handler);
    return () => {
      this.globalListeners.delete(handler);
    };
  };

  private safeInvokeListener = <T>(
    key: string,
    payload: T,
    listener: TypedEventHandler<T>,
  ): void => {
    try {
      listener(payload);
    } catch (error) {
      this.onListenerError?.({
        key,
        payload,
        error,
      });
    }
  };

  private safeInvokeGlobalListener = (
    event: TypedEventEnvelope,
    listener: (event: TypedEventEnvelope) => void,
  ): void => {
    try {
      listener(event);
    } catch (error) {
      this.onListenerError?.({
        key: event.key,
        payload: event.payload,
        error,
      });
    }
  };
}

export function createGlobalTypedEventBus(
  options: GlobalTypedEventBusOptions = {},
): GlobalTypedEventBus {
  return new GlobalTypedEventBus(options);
}
