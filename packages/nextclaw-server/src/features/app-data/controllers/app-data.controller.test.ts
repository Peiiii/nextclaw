import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { AppDataError } from "@nextclaw/kernel";
import { AppDataRoutesController } from "./app-data.controller.js";

function createTestApp(
  manager: ConstructorParameters<typeof AppDataRoutesController>[0],
) {
  const app = new Hono();
  const controller = new AppDataRoutesController(manager);
  app.get("/api/app-data", controller.list);
  app.delete("/api/app-data/:dataId", controller.deleteRetained);
  return app;
}

describe("AppDataRoutesController", () => {
  it("lists projected data and forwards explicit delete confirmation", async () => {
    const deleteRetained = vi.fn(async () => ({
      deleted: true as const,
      id: "data-1",
      appId: "example.notes",
      instanceId: "default",
    }));
    const app = createTestApp({
      list: async () => ({ entries: [], diagnostics: [] }),
      deleteRetained,
    } as never);

    const listResponse = await app.request("http://localhost/api/app-data");
    const deleteResponse = await app.request("http://localhost/api/app-data/data-1", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmAppId: "example.notes" }),
    });

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      ok: true,
      data: { entries: [], diagnostics: [] },
    });
    expect(deleteResponse.status).toBe(200);
    expect(deleteRetained).toHaveBeenCalledWith("data-1", "example.notes");
  });

  it("rejects missing confirmation and maps active conflicts", async () => {
    const app = createTestApp({
      list: async () => ({ entries: [], diagnostics: [] }),
      deleteRetained: async () => {
        throw new AppDataError("APP_DATA_ACTIVE", "still active");
      },
    } as never);

    const invalid = await app.request("http://localhost/api/app-data/data-1", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const conflict = await app.request("http://localhost/api/app-data/data-1", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmAppId: "example.notes" }),
    });

    expect(invalid.status).toBe(400);
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "APP_DATA_ACTIVE" },
    });
  });
});
