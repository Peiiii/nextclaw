import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { InboxDelivery } from "@nextclaw/shared";
import { InboxDeliveriesRoutesController } from "@nextclaw-server/features/inbox-deliveries/controllers/inbox-deliveries.controller.js";

vi.mock("@nextclaw/kernel", () => ({
  isInboxDeliveryError: (error: unknown) =>
    error instanceof Error && "code" in error,
}));

const delivery: InboxDelivery = {
  id: "delivery-1",
  title: "Research brief",
  summary: "The result",
  content: "<!doctype html><html><body><h1>Result</h1></body></html>",
  contentType: "html",
  source: {
    kind: "agent",
    agentId: "main",
    sessionId: "source-1",
    toolCallId: "call-1",
    filePath: null,
  },
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
  presentedAt: null,
  readAt: null,
  archivedAt: null,
};

function createTestApp(
  manager: ConstructorParameters<typeof InboxDeliveriesRoutesController>[0],
) {
  const app = new Hono();
  const controller = new InboxDeliveriesRoutesController(manager);
  app.get("/api/inbox/deliveries", controller.list);
  app.get("/api/inbox/deliveries/:deliveryId", controller.get);
  app.patch("/api/inbox/deliveries/:deliveryId", controller.updateState);
  app.delete("/api/inbox/deliveries/:deliveryId", controller.delete);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("inbox delivery routes", () => {
  it("lists deliveries and updates their lifecycle through the kernel owner", async () => {
    const updateDeliveryState = vi.fn(async () => ({
      ...delivery,
      presentedAt: "2026-08-06T01:00:00.000Z",
    }));
    const app = createTestApp({
      listDeliveries: async () => ({
        deliveries: [delivery],
        total: 1,
        unreadCount: 1,
        unpresentedCount: 1,
      }),
      getDelivery: async () => delivery,
      updateDeliveryState,
      deleteDelivery: async () => true,
    } as never);

    const listResponse = await app.request("http://localhost/api/inbox/deliveries");
    const patchResponse = await app.request("http://localhost/api/inbox/deliveries/delivery-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "present" }),
    });

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      data: {
        deliveries: [{ contentType: "html", content: delivery.content }],
        total: 1,
      },
    });
    expect(patchResponse.status).toBe(200);
    expect(updateDeliveryState).toHaveBeenCalledWith("delivery-1", "present");
  });

  it("rejects invalid state actions", async () => {
    const app = createTestApp({
      listDeliveries: async () => ({ deliveries: [], total: 0, unreadCount: 0, unpresentedCount: 0 }),
      getDelivery: async () => delivery,
      updateDeliveryState: async () => delivery,
      deleteDelivery: async () => false,
    } as never);
    const invalidResponse = await app.request(
      "http://localhost/api/inbox/deliveries/delivery-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      },
    );

    expect(invalidResponse.status).toBe(400);
  });
});
