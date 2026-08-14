import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { AppPackagesRoutesController } from "@nextclaw-server/features/app-packages/controllers/app-packages.controller.js";

function createTestApp(
  manager: ConstructorParameters<typeof AppPackagesRoutesController>[0],
) {
  const app = new Hono();
  const controller = new AppPackagesRoutesController(manager);
  app.get("/api/app-packages", controller.list);
  app.get("/api/app-package-operations", controller.listOperations);
  app.post("/api/app-package-operations/install", controller.startInstallOperation);
  app.post(
    "/api/app-package-operations/:appId/update",
    controller.startUpdateOperation,
  );
  app.post(
    "/api/app-package-operations/:appId/rollback",
    controller.startRollbackOperation,
  );
  app.post(
    "/api/app-package-operations/:appId/uninstall",
    controller.startUninstallOperation,
  );
  return app;
}

const operation = {
  id: "operation-1",
  action: "install" as const,
  source: "nextclaw.workspace-glance",
  status: "queued" as const,
  completedSteps: 0,
  totalSteps: 5,
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
};

describe("app package operation routes", () => {
  it("lets UI callers skip recursive storage measurement without changing the default", async () => {
    const listPackages = vi.fn(async () => ({ entries: [] }));
    const app = createTestApp({ listPackages } as never);

    const response = await app.request(
      "http://localhost/api/app-packages?includeStorageUsage=false",
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { entries: [] },
    });
    await app.request("http://localhost/api/app-packages");

    expect(listPackages).toHaveBeenNthCalledWith(1, { includeStorageUsage: false });
    expect(listPackages).toHaveBeenNthCalledWith(2, { includeStorageUsage: true });
  });

  it("accepts lifecycle requests without waiting for operation completion", async () => {
    const startOperation = vi.fn(async () => operation);
    const app = createTestApp({
      listOperations: async () => ({ entries: [operation] }),
      startOperation,
    } as never);

    const requests = [
      app.request("http://localhost/api/app-package-operations/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "nextclaw.workspace-glance",
          registryUrl: "https://registry.example/apps/",
        }),
      }),
      app.request(
        "http://localhost/api/app-package-operations/nextclaw.personal%2Forganizer/update",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: "0.1.2" }),
        },
      ),
      app.request(
        "http://localhost/api/app-package-operations/nextclaw.personal%2Forganizer/rollback",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: "0.1.0" }),
        },
      ),
      app.request(
        "http://localhost/api/app-package-operations/nextclaw.personal%2Forganizer/uninstall",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ purgeData: true }),
        },
      ),
    ];
    const responses = await Promise.all(requests);

    expect(responses.map((response) => response.status)).toEqual([202, 202, 202, 202]);
    expect(startOperation).toHaveBeenNthCalledWith(1, {
      action: "install",
      source: "nextclaw.workspace-glance",
      registryUrl: "https://registry.example/apps/",
    });
    expect(startOperation).toHaveBeenNthCalledWith(2, {
      action: "update",
      appId: "nextclaw.personal/organizer",
      version: "0.1.2",
      registryUrl: undefined,
    });
    expect(startOperation).toHaveBeenNthCalledWith(3, {
      action: "rollback",
      appId: "nextclaw.personal/organizer",
      version: "0.1.0",
    });
    expect(startOperation).toHaveBeenNthCalledWith(4, {
      action: "uninstall",
      appId: "nextclaw.personal/organizer",
      purgeData: true,
    });
    await expect(responses[0]?.json()).resolves.toMatchObject({
      ok: true,
      data: { id: "operation-1", status: "queued" },
    });
  });

  it("lists durable operations and rejects incomplete requests", async () => {
    const startOperation = vi.fn(async () => operation);
    const app = createTestApp({
      listOperations: async () => ({ entries: [operation] }),
      startOperation,
    } as never);

    const listResponse = await app.request("http://localhost/api/app-package-operations");
    const invalidInstall = await app.request(
      "http://localhost/api/app-package-operations/install",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const invalidRollback = await app.request(
      "http://localhost/api/app-package-operations/nextclaw.demo/rollback",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      data: { entries: [{ id: "operation-1" }] },
    });
    expect(invalidInstall.status).toBe(400);
    expect(invalidRollback.status).toBe(400);
    expect(startOperation).not.toHaveBeenCalled();
  });
});
