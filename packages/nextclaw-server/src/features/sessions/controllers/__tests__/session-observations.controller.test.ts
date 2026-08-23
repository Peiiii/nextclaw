import { afterEach, describe, expect, it, vi } from "vitest";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

function createObservationFixture() {
  const state = {
    bindings: [{
      bindingId: "binding-1",
      extensionId: "world-extension",
      config: { project: "nextclaw", apiToken: "do-not-leak" },
      target: { sessionId: "session-1", agentId: "default" },
      projection: { maxChars: 1000 },
      status: "active" as const,
      createdAt: "2026-08-23T08:00:00.000Z",
      lastReadAt: "2026-08-23T08:05:00.000Z",
    }],
    subscriptions: [{
      subscriptionId: "subscription-1",
      extensionId: "world-extension",
      config: { eventType: "issue.updated" },
      target: { sessionId: "session-1", agentId: "default" },
      admission: {},
      delivery: "queue" as const,
      budget: { maxPending: 10 },
      status: "paused" as const,
      statusReason: "Paused by the user.",
      createdAt: "2026-08-23T08:01:00.000Z",
      suppressedCount: 2,
    }],
    deliveries: [{
      deliveryId: "delivery-1",
      subscriptionId: "subscription-1",
      eventId: "event-1",
      event: {} as never,
      targetSessionId: "session-1",
      requestedDelivery: "queue" as const,
      status: "pending" as const,
      ingressIdempotencyKey: "key-1",
      messageId: "message-1",
      createdAt: "2026-08-23T08:02:00.000Z",
      updatedAt: "2026-08-23T08:02:00.000Z",
    }],
  };
  const getObservation = vi.fn(async (ref: { kind: string; id: string }) => {
    if (ref.kind === "context_binding" && ref.id === "binding-1") return state.bindings[0];
    if (ref.kind === "event_subscription" && ref.id === "subscription-1") return state.subscriptions[0];
    if (ref.id === "foreign") return { ...state.bindings[0], bindingId: "foreign", target: { sessionId: "session-2", agentId: "default" } };
    return null;
  });
  const updateObservation = vi.fn(async () => ({ observation: null, remainingDeliveries: 0 }));
  const app = createUiRouter({
    configPath: "/tmp/nextclaw-observation-test-config.json",
    appEventBus: createRouterTestKernel().eventBus,
    kernel: createRouterTestKernel({
      sessionManager: {
        getSession: async (sessionId: string) => sessionId === "missing" ? null : { sessionId },
      } as never,
      observations: {
        listObservations: vi.fn(async () => state),
        discoverObservations: vi.fn(() => [{
          extensionId: "world-extension",
          kind: "context" as const,
          title: "World",
          description: "Latest world state",
        }, {
          extensionId: "world-extension",
          kind: "events" as const,
          title: "World",
          description: "World events",
        }]),
        getObservation,
        updateObservation,
      } as never,
    }),
  });
  return { app, getObservation, updateObservation };
}

afterEach(() => vi.restoreAllMocks());

describe("NcpSessionRoutesController observations", () => {
  it("projects only the requested session and masks sensitive config values", async () => {
    const { app } = createObservationFixture();
    const response = await app.request("http://localhost/api/ncp/sessions/session-1/observations");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      data: {
        sessionId: "session-1",
        counts: { total: 2, context: 1, events: 1, needsAttention: 1 },
        bindings: [{
          id: "binding-1",
          title: "World",
          safeConfigPreview: "project: nextclaw · apiToken: ••••••",
          lastReadAt: "2026-08-23T08:05:00.000Z",
        }],
        subscriptions: [{ id: "subscription-1", pendingCount: 1, suppressedCount: 2 }],
      },
    });
    expect(JSON.stringify(payload)).not.toContain("do-not-leak");
  });

  it("rejects updates for a relationship owned by another session", async () => {
    const { app, getObservation, updateObservation } = createObservationFixture();
    const response = await app.request("http://localhost/api/ncp/sessions/session-1/observations/context/foreign", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });

    expect(response.status).toBe(404);
    expect(getObservation).toHaveBeenCalledWith({ kind: "context_binding", id: "foreign" });
    expect(updateObservation).not.toHaveBeenCalled();
  });

  it("updates a current-session relationship through the typed action route", async () => {
    const { app, updateObservation } = createObservationFixture();
    const response = await app.request("http://localhost/api/ncp/sessions/session-1/observations/events/subscription-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });

    expect(response.status).toBe(200);
    expect(updateObservation).toHaveBeenCalledWith("pause", { kind: "event_subscription", id: "subscription-1" });
  });
});
