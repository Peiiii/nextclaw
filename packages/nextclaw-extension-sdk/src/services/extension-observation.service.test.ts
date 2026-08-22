import { EventBus } from "@nextclaw/shared";
import { describe, expect, it, vi } from "vitest";
import { ExtensionObservationService } from "./extension-observation.service.js";

describe("ExtensionObservationService", () => {
  it("dispatches reads, keeps duplicate subscriptions idempotent, and aborts cleanup on close", async () => {
    const eventBus = new EventBus();
    const respondToRequest = vi.fn(async () => undefined);
    const postIngress = vi.fn(async () => ({ accepted: true }));
    const service = new ExtensionObservationService({
      eventBus,
      extensionId: "fake-extension",
      generation: "generation-1",
      transport: { respondToRequest, postIngress } as never,
    });
    const read = vi.fn(async ({ config }: { config: unknown }) => ({
      config,
      current: true,
    }));
    const cleanup = vi.fn(async () => undefined);
    let subscriptionSignal: AbortSignal | undefined;
    const subscribe = vi.fn(async ({ signal, emit }) => {
      subscriptionSignal = signal;
      await emit({
        id: "event-1",
        type: "file.changed",
        occurredAt: "2026-08-22T00:00:00.000Z",
        payload: { changed: true },
      });
      return cleanup;
    });
    service.provide({ read, subscribe, replay: "supported" });

    eventBus.emitEnvelope({
      type: "extension.request",
      payload: {
        requestId: "read-1",
        extensionId: "fake-extension",
        generation: "generation-1",
        kind: "observation.read",
        payload: { config: { path: "payments.ts" } },
      },
    });
    await vi.waitFor(() =>
      expect(respondToRequest).toHaveBeenCalledWith({
        requestId: "read-1",
        ok: true,
        data: { config: { path: "payments.ts" }, current: true },
      }),
    );

    const subscriptionRequest = {
      extensionId: "fake-extension",
      generation: "generation-1",
      kind: "observation.subscribe",
      payload: {
        subscriptionId: "subscription-1",
        config: { path: "payments.ts" },
      },
    };
    eventBus.emitEnvelope({
      type: "extension.request",
      payload: { requestId: "subscribe-1", ...subscriptionRequest },
    });
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    expect(postIngress).toHaveBeenCalledWith(
      "extension.observation.event",
      expect.objectContaining({
        subscriptionId: "subscription-1",
        event: expect.objectContaining({ eventId: "event-1" }),
      }),
    );

    eventBus.emitEnvelope({
      type: "extension.request",
      payload: { requestId: "subscribe-2", ...subscriptionRequest },
    });
    await vi.waitFor(() =>
      expect(respondToRequest).toHaveBeenCalledWith({
        requestId: "subscribe-2",
        ok: true,
        data: { replay: "supported" },
      }),
    );
    expect(subscribe).toHaveBeenCalledTimes(1);

    await service.close();
    expect(subscriptionSignal?.aborted).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("responds with the declared-handler mismatch without invoking a missing provider", async () => {
    const eventBus = new EventBus();
    const respondToRequest = vi.fn(async () => undefined);
    const service = new ExtensionObservationService({
      eventBus,
      extensionId: "fake-extension",
      generation: "generation-1",
      transport: { respondToRequest } as never,
    });
    service.provide({ read: async () => ({}) });

    eventBus.emitEnvelope({
      type: "extension.request",
      payload: {
        requestId: "subscribe-1",
        extensionId: "fake-extension",
        generation: "generation-1",
        kind: "observation.subscribe",
        payload: { subscriptionId: "subscription-1", config: {} },
      },
    });
    await vi.waitFor(() =>
      expect(respondToRequest).toHaveBeenCalledWith({
        requestId: "subscribe-1",
        ok: false,
        error: { message: "Observation events are not provided." },
      }),
    );
  });
});
