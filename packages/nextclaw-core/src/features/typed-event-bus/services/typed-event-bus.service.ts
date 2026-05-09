import { EventBus, type EventHandler } from "@nextclaw/shared";
import {
  type TypedEventKey,
  readTypedEventKeyId,
} from "@core/features/typed-event-bus/types/typed-event-key.types.js";

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
  private readonly bus: EventBus;
  private readonly handlers = new WeakMap<
    TypedEventHandler<unknown>,
    Map<string, EventHandler<unknown>>
  >();

  constructor(options: GlobalTypedEventBusOptions = {}) {
    this.bus = new EventBus({
      onListenerError: options.onListenerError
        ? ({ type, payload, error }) =>
            options.onListenerError?.({
              key: type,
              payload,
              error,
            })
        : undefined,
    });
  }

  emit = <T>(key: TypedEventKey<T>, payload: T): void => {
    this.bus.emit({ id: readTypedEventKeyId(key) }, payload);
  };

  on = <T>(key: TypedEventKey<T>, handler: TypedEventHandler<T>): (() => void) => {
    const eventKey = readTypedEventKeyId(key);
    const wrappedHandler: EventHandler<T> = (payload) => {
      handler(payload);
    };
    const handlersByKey =
      this.handlers.get(handler as TypedEventHandler<unknown>) ??
      new Map<string, EventHandler<unknown>>();
    handlersByKey.set(eventKey, wrappedHandler as EventHandler<unknown>);
    this.handlers.set(handler as TypedEventHandler<unknown>, handlersByKey);
    return this.bus.on({ id: eventKey }, wrappedHandler);
  };

  off = <T>(key: TypedEventKey<T>, handler: TypedEventHandler<T>): void => {
    const eventKey = readTypedEventKeyId(key);
    const handlersByKey = this.handlers.get(handler as TypedEventHandler<unknown>);
    const wrappedHandler = handlersByKey?.get(eventKey);
    if (!handlersByKey || !wrappedHandler) {
      return;
    }
    this.bus.off({ id: eventKey }, wrappedHandler);
    handlersByKey.delete(eventKey);
    if (handlersByKey.size === 0) {
      this.handlers.delete(handler as TypedEventHandler<unknown>);
    }
  };

  once = <T>(key: TypedEventKey<T>, handler: TypedEventHandler<T>): (() => void) => {
    const eventKey = readTypedEventKeyId(key);
    return this.bus.once({ id: eventKey }, (payload) => {
      handler(payload as T);
    });
  };

  subscribeAll = (handler: (event: TypedEventEnvelope) => void): (() => void) => {
    return this.bus.subscribeAll((event) => {
      handler({
        key: event.type,
        payload: event.payload,
      });
    });
  };
}

export function createGlobalTypedEventBus(
  options: GlobalTypedEventBusOptions = {},
): GlobalTypedEventBus {
  return new GlobalTypedEventBus(options);
}
