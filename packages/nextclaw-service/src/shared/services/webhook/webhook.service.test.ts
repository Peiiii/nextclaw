import { describe, expect, it, vi } from "vitest";
import { WebhookService } from "./webhook.service.js";

describe("WebhookService", () => {
  it("dispatches generic webhook envelopes by type", async () => {
    const webhook = new WebhookService();
    const handler = vi.fn(async () => ({ ok: true }));
    webhook.addHandler("demo.event", handler);

    await expect(webhook.handleWebhook({
      type: "demo.event",
      payload: { value: 1 },
    }, {
      token: "token",
      request: new Request("http://localhost/webhook"),
    })).resolves.toEqual({ ok: true });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "demo.event" }),
      expect.objectContaining({ token: "token" }),
    );
  });
});
