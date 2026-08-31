import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { AppPackagesRoutesController } from "@nextclaw-server/features/app-packages/controllers/app-packages.controller.js";

function createTestApp(manager: ConstructorParameters<typeof AppPackagesRoutesController>[0]) {
  const app = new Hono();
  const controller = new AppPackagesRoutesController(manager);
  app.get("/api/app-packages", controller.list);
  app.get("/api/app-package-operations", controller.listOperations);
  app.post("/api/app-package-operations/install", controller.startInstallOperation);
  app.post("/api/app-package-operations/:appId/update", controller.startUpdateOperation);
  app.post("/api/app-package-operations/:appId/rollback", controller.startRollbackOperation);
  app.post("/api/app-package-operations/:appId/uninstall", controller.startUninstallOperation);
  app.get("/api/app-packages/:appId/dependencies", controller.inspectDependencies);
  app.get("/api/app-packages/:appId/dependencies/verify", controller.verifyDependencies);
  app.post("/api/app-packages/:appId/dependencies/setup", controller.setupDependencies);
  app.post("/api/app-packages/:appId/dependencies/bind", controller.bindDependency);
  app.post("/api/app-packages/:appId/dependencies/unbind", controller.unbindDependency);
  app.get("/api/app-packages/:appId/secrets", controller.inspectSecrets);
  app.post("/api/app-packages/:appId/secrets/verify", controller.verifySecrets);
  app.post("/api/app-packages/:appId/secrets/bind", controller.bindSecret);
  app.post("/api/app-packages/:appId/secrets/unbind", controller.unbindSecret);
  app.get("/api/app-packages/:appId/document-access", controller.inspectDocumentAccess);
  app.post("/api/app-packages/:appId/document-access/grant", controller.grantDocumentAccess);
  app.post("/api/app-packages/:appId/document-access/revoke", controller.revokeDocumentAccess);
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

describe("app package document access routes", () => {
  it("routes document scope inspection, grant, and revoke through the package owner", async () => {
    const state = {
      appId: "demo",
      name: "Demo",
      activeVersion: "0.1.0",
      documentAccess: [],
      allowedDomains: [],
      storage: { enabled: false },
      capabilities: { hostBridge: true },
    };
    const manager = {
      inspectDocumentAccess: vi.fn(async () => state),
      grantDocumentAccess: vi.fn(async () => ({
        appId: "demo",
        scopeId: "workspace",
      })),
      revokeDocumentAccess: vi.fn(async () => ({
        appId: "demo",
        scopeId: "workspace",
        removed: true,
      })),
    };
    const app = createTestApp(manager as never);
    const inspect = await app.request("http://localhost/api/app-packages/demo/document-access");
    const grant = await app.request("http://localhost/api/app-packages/demo/document-access/grant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scopeId: "workspace",
        directoryPath: "/srv/docs",
        mode: "read",
      }),
    });
    const revoke = await app.request("http://localhost/api/app-packages/demo/document-access/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scopeId: "workspace" }),
    });

    expect([inspect.status, grant.status, revoke.status]).toEqual([200, 200, 200]);
    expect(manager.grantDocumentAccess).toHaveBeenCalledWith("demo", {
      scopeId: "workspace",
      directoryPath: "/srv/docs",
      mode: "read",
    });
    expect(manager.revokeDocumentAccess).toHaveBeenCalledWith("demo", "workspace");
  });
});

describe("app package operation routes", () => {
  it("exposes dependency inspection and mutation routes through the manager", async () => {
    const dependencyView = {
      readiness: { status: "ready", requirements: [] },
      bindings: [],
      candidates: [],
      resolvedProviderIds: {},
    };
    const manager = {
      inspectDependencies: vi.fn(async () => dependencyView),
      verifyDependencies: vi.fn(async () => dependencyView),
      setupDependencies: vi.fn(async () => dependencyView),
      bindDependency: vi.fn(async (_appId: string, input: unknown) => ({
        ...dependencyView,
        input,
      })),
      unbindDependency: vi.fn(async (_appId: string, input: unknown) => ({
        ...dependencyView,
        input,
      })),
    };
    const app = createTestApp(manager as never);
    const inspect = await app.request("http://localhost/api/app-packages/demo/dependencies");
    const setup = await app.request("http://localhost/api/app-packages/demo/dependencies/setup", { method: "POST" });
    const bind = await app.request("http://localhost/api/app-packages/demo/dependencies/bind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        componentId: "state",
        requirementKind: "capability",
        requirementId: "cache",
        providerId: "redis",
      }),
    });
    expect(inspect.status).toBe(200);
    expect(setup.status).toBe(200);
    expect(bind.status).toBe(200);
    expect(manager.inspectDependencies).toHaveBeenCalledWith("demo");
    expect(manager.setupDependencies).toHaveBeenCalledWith("demo");
    expect(manager.bindDependency).toHaveBeenCalledWith("demo", expect.objectContaining({ providerId: "redis" }));

    const invalid = await app.request("http://localhost/api/app-packages/demo/dependencies/bind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requirementKind: "anything",
        providerId: "redis",
      }),
    });
    expect(invalid.status).toBe(400);
    expect(manager.bindDependency).toHaveBeenCalledTimes(1);
  });

  it("lets UI callers skip recursive storage measurement without changing the default", async () => {
    const hostTarget = {
      key: "darwin-arm64",
      operatingSystem: "darwin" as const,
      architecture: "arm64" as const,
    };
    const listPackages = vi.fn(async () => ({ entries: [], hostTarget }));
    const app = createTestApp({ listPackages } as never);

    const response = await app.request("http://localhost/api/app-packages?includeStorageUsage=false");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { entries: [], hostTarget },
    });
    await app.request("http://localhost/api/app-packages");

    expect(listPackages).toHaveBeenNthCalledWith(1, {
      includeStorageUsage: false,
    });
    expect(listPackages).toHaveBeenNthCalledWith(2, {
      includeStorageUsage: true,
    });
  });

  it("exposes only redacted App Secret binding operations", async () => {
    const secretView = {
      readiness: { status: "needs-configuration", requirements: [] },
      slots: [
        {
          id: "issue-api-token",
          title: "Issue token",
          description: "",
          required: true,
          status: "unbound",
          errorCode: "SECRET_BINDING_MISSING",
        },
      ],
    };
    const manager = {
      inspectSecrets: vi.fn(async () => secretView),
      verifySecrets: vi.fn(async () => secretView),
      bindSecret: vi.fn(async () => secretView),
      unbindSecret: vi.fn(async () => secretView),
    };
    const app = createTestApp(manager as never);
    const inspect = await app.request("http://localhost/api/app-packages/demo/secrets");
    const bind = await app.request("http://localhost/api/app-packages/demo/secrets/bind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slotId: "issue-api-token",
        source: "env",
        id: "ISSUE_API_TOKEN",
      }),
    });
    const verify = await app.request("http://localhost/api/app-packages/demo/secrets/verify", { method: "POST" });
    const unbind = await app.request("http://localhost/api/app-packages/demo/secrets/unbind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slotId: "issue-api-token" }),
    });
    expect([inspect.status, bind.status, verify.status, unbind.status]).toEqual([200, 200, 200, 200]);
    expect(manager.bindSecret).toHaveBeenCalledWith("demo", {
      slotId: "issue-api-token",
      binding: { source: "env", provider: undefined, id: "ISSUE_API_TOKEN" },
    });
    await expect(bind.json()).resolves.not.toHaveProperty("data.slots.0.value");
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
      app.request("http://localhost/api/app-package-operations/nextclaw.personal%2Forganizer/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: "0.1.2" }),
      }),
      app.request("http://localhost/api/app-package-operations/nextclaw.personal%2Forganizer/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: "0.1.0" }),
      }),
      app.request("http://localhost/api/app-package-operations/nextclaw.personal%2Forganizer/uninstall", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purgeData: true }),
      }),
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
    const invalidInstall = await app.request("http://localhost/api/app-package-operations/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const invalidRollback = await app.request("http://localhost/api/app-package-operations/nextclaw.demo/rollback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      data: { entries: [{ id: "operation-1" }] },
    });
    expect(invalidInstall.status).toBe(400);
    expect(invalidRollback.status).toBe(400);
    expect(startOperation).not.toHaveBeenCalled();
  });
});
