import { describe, expect, it, vi } from "vitest";
import {
  createGlobalTypedEventBus,
  createTypedEventKey,
} from "./index.js";

describe("GlobalTypedEventBus", () => {
  it("binds payload types to event keys", () => {
    const bus = createGlobalTypedEventBus();
    const runFinished = createTypedEventKey<{ sessionId: string }>("agent.run.finished");
    const listener = vi.fn();

    bus.on(runFinished, listener);
    bus.emit(runFinished, { sessionId: "session-1" });

    expect(listener).toHaveBeenCalledWith({ sessionId: "session-1" });
  });

  it("supports once listeners", () => {
    const bus = createGlobalTypedEventBus();
    const sessionUpdated = createTypedEventKey<{ sessionId: string }>("agent.session.updated");
    const listener = vi.fn();

    bus.once(sessionUpdated, listener);
    bus.emit(sessionUpdated, { sessionId: "session-1" });
    bus.emit(sessionUpdated, { sessionId: "session-2" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ sessionId: "session-1" });
  });

  it("isolates listener failures", () => {
    const errorHandler = vi.fn();
    const bus = createGlobalTypedEventBus({
      onListenerError: errorHandler,
    });
    const eventKey = createTypedEventKey<{ value: string }>("test.event");
    const healthyListener = vi.fn();

    bus.on(eventKey, () => {
      throw new Error("boom");
    });
    bus.on(eventKey, healthyListener);

    bus.emit(eventKey, { value: "ok" });

    expect(healthyListener).toHaveBeenCalledWith({ value: "ok" });
    expect(errorHandler).toHaveBeenCalledTimes(1);
  });

  it("supports subscribeAll for debugging", () => {
    const bus = createGlobalTypedEventBus();
    const eventKey = createTypedEventKey<{ value: string }>("test.event");
    const listener = vi.fn();

    bus.subscribeAll(listener);
    bus.emit(eventKey, { value: "ok" });

    expect(listener).toHaveBeenCalledWith({
      key: "test.event",
      payload: { value: "ok" },
    });
  });
});
