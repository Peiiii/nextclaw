import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./event-bus.service.js";
import { createAppEventKey } from "./event.keys.js";

describe("EventBus", () => {
  const key = createAppEventKey<{ value: string }>("test.event");

  it("dispatches typed events to key listeners and global subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const globalHandler = vi.fn();

    bus.on(key, handler);
    bus.subscribeAll(globalHandler);
    bus.emit(key, { value: "ok" }, { emittedAt: "2026-05-07T00:00:00.000Z", source: "backend" });

    expect(handler).toHaveBeenCalledWith(
      { value: "ok" },
      expect.objectContaining({
        type: "test.event",
        payload: { value: "ok" },
        emittedAt: "2026-05-07T00:00:00.000Z",
        source: "backend"
      })
    );
    expect(globalHandler).toHaveBeenCalledWith(expect.objectContaining({ type: "test.event" }));
  });

  it("supports unsubscribe and once subscriptions", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const onceHandler = vi.fn();
    const unsubscribe = bus.on(key, handler);

    bus.once(key, onceHandler);
    bus.emit(key, { value: "first" });
    unsubscribe();
    bus.emit(key, { value: "second" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(onceHandler).toHaveBeenCalledTimes(1);
    expect(onceHandler).toHaveBeenCalledWith(
      { value: "first" },
      expect.objectContaining({ type: "test.event" })
    );
  });

  it("reports listener errors without blocking other subscribers", () => {
    const onListenerError = vi.fn();
    const bus = new EventBus({ onListenerError });
    const healthyHandler = vi.fn();

    bus.on(key, () => {
      throw new Error("boom");
    });
    bus.on(key, healthyHandler);
    bus.emit(key, { value: "ok" });

    expect(onListenerError).toHaveBeenCalledWith(expect.objectContaining({ type: "test.event" }));
    expect(healthyHandler).toHaveBeenCalledWith(
      { value: "ok" },
      expect.objectContaining({ type: "test.event" })
    );
  });

  it("reports first and last subscriber lifecycle", () => {
    const onFirstSubscriber = vi.fn();
    const onNoSubscribers = vi.fn();
    const bus = new EventBus({ onFirstSubscriber, onNoSubscribers });
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const unsubscribeFirst = bus.on(key, firstHandler);
    const unsubscribeSecond = bus.subscribeAll(secondHandler);

    unsubscribeFirst();
    expect(onNoSubscribers).not.toHaveBeenCalled();
    unsubscribeSecond();

    expect(onFirstSubscriber).toHaveBeenCalledTimes(1);
    expect(onNoSubscribers).toHaveBeenCalledTimes(1);
  });
});
