import { access, mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CapabilityGrantManager } from "@kernel/features/capability-grants/managers/capability-grant.manager.js";
import { CapabilityGrantLegacyMigrationService } from "./capability-grant-legacy-migration.service.js";

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "nextclaw-capability-migration-"));
  const workspacePath = join(root, "workspace");
  const markerPath = join(root, "legacy-v1-migration.json");
  const manager = new CapabilityGrantManager(join(root, "grants.json"));
  const service = new CapabilityGrantLegacyMigrationService({
    capabilityGrantManager: manager,
    markerPath,
    validateGrant: async () => true,
    workspacePath,
  });
  return {
    manager,
    markerPath,
    service,
    panelAgentPath: join(workspacePath, "panels", ".panel-app-capability-grants.json"),
    panelClientPath: join(workspacePath, "panels", ".panel-app-client-grants.json"),
    serviceActionPath: join(workspacePath, "service-apps", ".service-action-grants.json"),
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value), "utf8");
}

async function exists(path: string): Promise<boolean> {
  return await access(path).then(() => true, () => false);
}

describe("CapabilityGrantLegacyMigrationService", () => {
  it("imports all legacy Panel and Service Action grants before deleting their files", async () => {
    const fixture = await createFixture();
    await writeJson(fixture.panelAgentPath, {
      version: 1,
      grants: {
        "panel-app:chat-panel": {
          capabilities: { "agent:send": { grantedAt: "2026-08-01T00:00:00.000Z" } },
        },
      },
    });
    await writeJson(fixture.panelClientPath, {
      version: 1,
      grants: { "chat-panel": { grantedAt: "2026-08-02T00:00:00.000Z" } },
    });
    await writeJson(fixture.serviceActionPath, {
      version: 1,
      grants: {
        "panel-app:chat-panel": {
          actions: {
            "notes.save": { grantedAt: "2026-08-03T00:00:00.000Z", risk: "write" },
          },
        },
      },
    });

    await fixture.service.migrate();

    expect(await fixture.manager.list()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        subject: { type: "panel-app", id: "chat-panel" },
        resource: { type: "agent.capability", target: { capability: "agent:send" } },
        grantedAt: "2026-08-01T00:00:00.000Z",
      }),
      expect.objectContaining({
        resource: { type: "nextclaw.client", target: { appId: "chat-panel" } },
        grantedAt: "2026-08-02T00:00:00.000Z",
      }),
      expect.objectContaining({
        resource: { type: "service.action", target: { actionId: "notes.save" } },
        grantedAt: "2026-08-03T00:00:00.000Z",
      }),
    ]));
    await expect(Promise.all([
      exists(fixture.panelAgentPath),
      exists(fixture.panelClientPath),
      exists(fixture.serviceActionPath),
    ])).resolves.toEqual([false, false, false]);
    await expect(exists(fixture.markerPath)).resolves.toBe(true);
  });

  it.each([
    ["unsupported version", { version: 2, grants: {} }],
    ["invalid schema", { version: 1, grants: { panel: { grantedAt: 42 } } }],
  ])("retains every legacy file when one source has %s", async (_name, invalidSource) => {
    const fixture = await createFixture();
    await writeJson(fixture.panelClientPath, invalidSource);
    await writeJson(fixture.serviceActionPath, {
      version: 1,
      grants: {
        "panel-app:chat-panel": {
          actions: {
            "notes.save": { grantedAt: "2026-08-03T00:00:00.000Z", risk: "write" },
          },
        },
      },
    });

    await expect(fixture.service.migrate()).rejects.toThrow();

    await expect(Promise.all([
      exists(fixture.panelClientPath),
      exists(fixture.serviceActionPath),
    ])).resolves.toEqual([true, true]);
    await expect(fixture.manager.list()).resolves.toEqual([]);
  });

  it("retains all source files when the unified import fails", async () => {
    const fixture = await createFixture();
    await writeJson(fixture.panelClientPath, {
      version: 1,
      grants: { "chat-panel": { grantedAt: "2026-08-02T00:00:00.000Z" } },
    });
    await writeJson(fixture.serviceActionPath, { version: 1, grants: {} });
    const clientModifiedAt = (await stat(fixture.panelClientPath)).mtimeMs;
    const serviceModifiedAt = (await stat(fixture.serviceActionPath)).mtimeMs;
    vi.spyOn(fixture.manager, "import").mockRejectedValueOnce(new Error("import failed"));

    await expect(fixture.service.migrate()).rejects.toThrow("import failed");

    await expect(Promise.all([
      exists(fixture.panelClientPath),
      exists(fixture.serviceActionPath),
    ])).resolves.toEqual([true, true]);
    expect((await stat(fixture.panelClientPath)).mtimeMs).toBe(clientModifiedAt);
    expect((await stat(fixture.serviceActionPath)).mtimeMs).toBe(serviceModifiedAt);
  });

  it("restores the original unified store when an import mutates and then fails", async () => {
    const fixture = await createFixture();
    await fixture.manager.grant({
      subject: { type: "panel-app", id: "existing-panel" },
      resource: { type: "nextclaw.client", target: { appId: "existing-panel" } },
      access: ["connect"],
      declarationFingerprint: "existing-fingerprint",
    }, "2026-08-01T00:00:00.000Z");
    await writeJson(fixture.panelClientPath, {
      version: 1,
      grants: { "chat-panel": { grantedAt: "2026-08-02T00:00:00.000Z" } },
    });
    vi.spyOn(fixture.manager, "import").mockImplementationOnce(async (grants) => {
      await fixture.manager.replace([...(await fixture.manager.list()), ...grants]);
      throw new Error("import failed after write");
    });

    await expect(fixture.service.migrate()).rejects.toThrow("import failed after write");

    await expect(fixture.manager.list()).resolves.toEqual([
      expect.objectContaining({
        subject: { type: "panel-app", id: "existing-panel" },
        grantedAt: "2026-08-01T00:00:00.000Z",
      }),
    ]);
    await expect(exists(fixture.panelClientPath)).resolves.toBe(true);
  });

  it("is idempotent when run repeatedly", async () => {
    const fixture = await createFixture();
    await writeJson(fixture.panelClientPath, {
      version: 1,
      grants: { "chat-panel": { grantedAt: "2026-08-02T00:00:00.000Z" } },
    });

    await fixture.service.migrate();
    await fixture.service.migrate();

    await expect(fixture.manager.list({ resourceType: "nextclaw.client" })).resolves.toHaveLength(1);
    await expect(exists(fixture.panelClientPath)).resolves.toBe(false);
  });
});
