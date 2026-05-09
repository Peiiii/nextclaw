import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./event-bus.service.js";
import { createEventKey } from "../configs/event-keys.config.js";

describe("EventBus", () => {
  const key = createEventKey<{ value: string }>("test.event");

  it("delivers typed events to matching listeners", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on(key, handler);
    bus.emit(key, { value: "hello" }, { source: "local" });

    expect(handler).toHaveBeenCalledWith(
      { value: "hello" },
      expect.objectContaining({
        type: "test.event",
        payload: { value: "hello" },
        source: "local",
      }),
    );
  });

  it("removes listeners through unsubscribe", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsubscribe = bus.on(key, handler);

    unsubscribe();
    bus.emit(key, { value: "ignored" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("notifies global listeners for all events", () => {
    const bus = new EventBus();
    const globalHandler = vi.fn();

    bus.subscribeAll(globalHandler);
    bus.emit(key, { value: "hello" });

    expect(globalHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "test.event",
        payload: { value: "hello" },
      }),
    );
  });

  it("reports listener errors without stopping dispatch", () => {
    const onListenerError = vi.fn();
    const bus = new EventBus({ onListenerError });
    const error = new Error("boom");
    const healthyHandler = vi.fn();

    bus.on(key, () => {
      throw error;
    });
    bus.on(key, healthyHandler);
    bus.emit(key, { value: "hello" });

    expect(onListenerError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "test.event",
        payload: { value: "hello" },
        error,
      }),
    );
    expect(healthyHandler).toHaveBeenCalled();
  });

  it("tracks first and last subscribers", () => {
    const onFirstSubscriber = vi.fn();
    const onNoSubscribers = vi.fn();
    const bus = new EventBus({ onFirstSubscriber, onNoSubscribers });

    const unsubscribeFirst = bus.on(key, vi.fn());
    const unsubscribeSecond = bus.subscribeAll(vi.fn());

    expect(onFirstSubscriber).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    expect(onNoSubscribers).not.toHaveBeenCalled();

    unsubscribeSecond();
    expect(onNoSubscribers).toHaveBeenCalledTimes(1);
  });
});
