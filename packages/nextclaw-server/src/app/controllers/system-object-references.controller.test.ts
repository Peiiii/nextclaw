import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { SystemObjectReferenceError } from "@nextclaw/kernel";
import { SystemObjectReferencesRoutesController } from "./system-object-references.controller.js";

function createApp(manager: ConstructorParameters<typeof SystemObjectReferencesRoutesController>[0]) {
  const app = new Hono();
  const controller = new SystemObjectReferencesRoutesController(manager);
  app.get("/api/system-object-references", controller.list);
  app.post("/api/system-object-references/resolve", controller.resolve);
  return app;
}

describe("system object reference routes", () => {
  it("keeps discovery read-only and passes normalized search inputs", async () => {
    const listReferences = vi.fn(async () => ({ groups: [], total: 0 }));
    const app = createApp({ listReferences } as never);
    const response = await app.request(
      "http://localhost/api/system-object-references?query=report&limit=10&objectType=inbox-delivery",
    );

    expect(response.status).toBe(200);
    expect(listReferences).toHaveBeenCalledWith({
      query: "report",
      limit: 10,
      objectType: "inbox-delivery",
    });
  });

  it("returns a protocol error for an unknown resource group", async () => {
    const app = createApp({
      listReferences: async () => {
        throw new SystemObjectReferenceError(
          "SYSTEM_OBJECT_INVALID_REFERENCE",
          "unknown group",
        );
      },
    } as never);

    const response = await app.request(
      "http://localhost/api/system-object-references?objectType=unknown",
    );

    expect(response.status).toBe(400);
  });

  it("resolves a snapshot only through the explicit action", async () => {
    const resolveReference = vi.fn(async () => ({ uri: "nextclaw://objects/cron-job/cron-1" }));
    const app = createApp({ resolveReference } as never);
    const response = await app.request(
      "http://localhost/api/system-object-references/resolve",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uri: "nextclaw://objects/cron-job/cron-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(resolveReference).toHaveBeenCalledWith("nextclaw://objects/cron-job/cron-1");
  });

  it("maps a missing live object to 404 without fallback", async () => {
    const app = createApp({
      resolveReference: async () => {
        throw new SystemObjectReferenceError("SYSTEM_OBJECT_NOT_FOUND", "missing");
      },
    } as never);
    const response = await app.request(
      "http://localhost/api/system-object-references/resolve",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uri: "nextclaw://objects/cron-job/missing" }),
      },
    );

    expect(response.status).toBe(404);
  });
});
