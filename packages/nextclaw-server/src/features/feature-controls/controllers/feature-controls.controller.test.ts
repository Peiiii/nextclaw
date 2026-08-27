import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { FeatureControlsRoutesController } from "./feature-controls.controller.js";

describe("FeatureControlsRoutesController", () => {
  it("returns the shared backend feature-controls object", async () => {
    const get = vi.fn(async () => ({ desktopAutomation: { available: false } }));
    const app = new Hono();
    app.get("/api/feature-controls", new FeatureControlsRoutesController({ get }).get);

    const response = await app.request("http://localhost/api/feature-controls");

    expect(response.status).toBe(200);
    expect(get).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { desktopAutomation: { available: false } },
    });
  });
});
