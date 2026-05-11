import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import type { EventBus, Ingress } from "@nextclaw/shared";
import { createUiRouter } from "../router.js";

describe("ingress route", () => {
  it("passes webhook envelopes to the shared ingress", async () => {
    const handle = vi.fn(() => ({ accepted: true }));
    const app = createUiRouter({
      configPath: join(tmpdir(), "nextclaw-router-ingress-test.json"),
      appEventBus: {} as EventBus,
      ingress: { handle } as unknown as Ingress,
    });

    const response = await app.request("http://localhost/webhook", {
      method: "POST",
      headers: {
        authorization: "Bearer secret-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "test.ping",
        payload: { value: 1 },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { accepted: true },
    });
    expect(handle).toHaveBeenCalledWith(
      { type: "test.ping", payload: { value: 1 } },
      { source: "webhook", token: "secret-token" },
    );
  });
});
