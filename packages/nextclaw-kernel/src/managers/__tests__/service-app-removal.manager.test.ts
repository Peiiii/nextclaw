import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import { CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import type { ServiceAppError } from "@kernel/managers/service-app.manager.js";
import type {
  ServiceAction,
  ServiceActionCaller,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-service-app-manager-test-"));
  tempDirs.push(dir);
  return dir;
}

function createCapabilityGrantManager(): CapabilityGrantManager {
  return new CapabilityGrantManager(join(createTempDir(), "capability-grants.json"));
}

function createConfigManager(workspacePath: string, model?: string): ConfigManager {
  const configPath = join(createTempDir(), "config.json");
  saveConfig(
    ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: workspacePath,
          ...(model ? { model } : {}),
        },
      },
    }),
    configPath,
  );
  return new ConfigManager({
    configPath,
    channels: {
      load: vi.fn(),
      reload: vi.fn(),
    } as never,
    providerManager: {
      load: vi.fn(),
    } as never,
  });
}

function writeServiceApp(
  workspacePath: string,
  overrides: Partial<{
    command: string;
    args: string[];
    actions: Record<string, { risk: "read" | "write" | "external" | "dangerous" }>;
  }> = {},
): void {
  const appPath = join(workspacePath, "service-apps", "notes");
  mkdirSync(appPath, { recursive: true });
  writeFileSync(
    join(appPath, "service-app.json"),
    JSON.stringify({
      id: "notes",
      title: "Notes",
      protocol: "mcp",
      command: overrides.command ?? "node",
      args: overrides.args ?? ["server.mjs"],
      actions: overrides.actions ?? {
        read: { risk: "read" },
      },
    }),
  );
}

function createRuntime(
  actions: ServiceAction | ServiceAction[] = [],
  status: Pick<ServiceAppRecord, "lastFailedAt" | "lastReadyAt" | "lastStartedAt" | "status"> = { status: "idle" },
) {
  const actionList = Array.isArray(actions) ? actions : [actions];
  return {
    getLastObservation: vi.fn(() => undefined),
    getStatus: vi.fn(() => status),
    listActions: vi.fn(async () => actionList),
    invokeAction: vi.fn(async () => ({ ok: true })),
    restart: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("ServiceAppManager deletion", () => {
  it("deletes a service app directory and clears its grants", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath);
    const appPath = join(workspacePath, "service-apps", "notes");
    const runtime = createRuntime({
      id: "notes.read",
      appId: "notes",
      name: "read",
      risk: "read",
    });
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      capabilityGrantManager: createCapabilityGrantManager(),
      runtimeService: runtime,
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };

    await manager.grantServiceAction("notes.read", {
      caller,
      declaredActions: ["notes.read"],
    });
    await expect(manager.listServiceActionGrants()).resolves.toHaveLength(1);

    await expect(manager.deleteServiceApp("notes")).resolves.toEqual({
      deleted: true,
      id: "notes",
      dataRemoved: false,
    });

    expect(existsSync(appPath)).toBe(false);
    expect(existsSync(join(
      workspacePath,
      ".nextclaw",
      "app-instances",
      "notes",
      "default",
    ))).toBe(false);
    expect(runtime.stop).toHaveBeenCalledWith("notes");
    await expect(manager.listServiceActionGrants()).resolves.toEqual([]);
    await expect(manager.getServiceApp("notes")).rejects.toMatchObject({
      code: "SERVICE_APP_NOT_FOUND",
    } satisfies Partial<ServiceAppError>);
  });

  it("deletes the workspace instance only after explicit purge selection", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath);
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      capabilityGrantManager: createCapabilityGrantManager(),
      runtimeService: createRuntime(),
    });
    const instancePath = join(
      workspacePath,
      ".nextclaw",
      "app-instances",
      "notes",
      "default",
    );
    await manager.discoverServiceAppActions("notes");
    expect(existsSync(instancePath)).toBe(true);

    await expect(manager.deleteServiceApp("notes", true)).resolves.toEqual({
      deleted: true,
      id: "notes",
      dataRemoved: true,
    });

    expect(existsSync(instancePath)).toBe(false);
  });

  it("does not stop the runtime when grant revocation fails and restores source and grants", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath);
    const appPath = join(workspacePath, "service-apps", "notes");
    const runtime = createRuntime({
      id: "notes.read",
      appId: "notes",
      name: "read",
      risk: "read",
    });
    const capabilityGrantManager = createCapabilityGrantManager();
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      capabilityGrantManager,
      runtimeService: runtime,
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };
    await manager.grantServiceAction("notes.read", {
      caller,
      declaredActions: ["notes.read"],
    });
    vi.spyOn(capabilityGrantManager, "revokeMatching").mockImplementationOnce(async (matches) => {
      const revoked = (await capabilityGrantManager.list()).filter(matches);
      await capabilityGrantManager.replace(
        (await capabilityGrantManager.list()).filter((grant) => !matches(grant)),
      );
      expect(revoked).toHaveLength(1);
      throw new Error("revoke failed after write");
    });

    await expect(manager.deleteServiceApp("notes")).rejects.toThrow(
      "revoke failed after write",
    );

    expect(runtime.stop).not.toHaveBeenCalled();
    expect(existsSync(appPath)).toBe(true);
    await expect(manager.listServiceActionGrants()).resolves.toEqual([
      expect.objectContaining({ actionId: "notes.read", caller }),
    ]);
  });

  it("rejects an unsafe service app id before resolving managed paths", async () => {
    const workspacePath = createTempDir();
    const outsidePath = join(workspacePath, "outside");
    mkdirSync(outsidePath, { recursive: true });
    writeFileSync(join(outsidePath, "sentinel.txt"), "keep");
    const runtime = createRuntime([]);
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      capabilityGrantManager: createCapabilityGrantManager(),
      runtimeService: runtime,
    });

    await expect(manager.deleteServiceApp("../outside", true)).rejects.toMatchObject({
      code: "SERVICE_APP_INVALID_MANIFEST",
    } satisfies Partial<ServiceAppError>);

    expect(existsSync(join(outsidePath, "sentinel.txt"))).toBe(true);
    expect(runtime.restart).not.toHaveBeenCalled();
  });

  it("completes a committed source deletion tombstone during startup", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath);
    const appPath = join(workspacePath, "service-apps", "notes");
    const stagedPath = join(
      workspacePath,
      "service-apps",
      ".deleting-notes-123e4567-e89b-42d3-a456-426614174000",
    );
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      capabilityGrantManager: createCapabilityGrantManager(),
      runtimeService: createRuntime(),
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };
    await manager.grantServiceAction("notes.read", {
      caller,
      declaredActions: ["notes.read"],
    });
    renameSync(appPath, stagedPath);

    await manager.start();

    expect(existsSync(stagedPath)).toBe(false);
    await expect(manager.listServiceActionGrants()).resolves.toEqual([]);
    await expect(manager.listServiceApps()).resolves.toMatchObject({
      diagnostics: [],
      entries: [],
    });
  });

  it("keeps grants when a canonical source was restored before tombstone cleanup", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath);
    const appPath = join(workspacePath, "service-apps", "notes");
    const stagedPath = join(
      workspacePath,
      "service-apps",
      ".deleting-notes-123e4567-e89b-42d3-a456-426614174000",
    );
    cpSync(appPath, stagedPath, { recursive: true });
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      capabilityGrantManager: createCapabilityGrantManager(),
      runtimeService: createRuntime(),
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };
    await manager.grantServiceAction("notes.read", {
      caller,
      declaredActions: ["notes.read"],
    });

    await manager.start();

    expect(existsSync(stagedPath)).toBe(false);
    await expect(manager.listServiceActionGrants()).resolves.toEqual([
      expect.objectContaining({ actionId: "notes.read", caller }),
    ]);
    await expect(manager.listServiceApps()).resolves.toMatchObject({
      diagnostics: [],
      entries: [expect.objectContaining({ id: "notes" })],
    });
  });

  it("keeps an unverifiable source tombstone out of the app list and reports it", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath);
    const stagedPath = join(
      workspacePath,
      "service-apps",
      ".deleting-other-123e4567-e89b-42d3-a456-426614174000",
    );
    renameSync(join(workspacePath, "service-apps", "notes"), stagedPath);
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      capabilityGrantManager: createCapabilityGrantManager(),
      runtimeService: createRuntime(),
    });

    await manager.start();

    expect(existsSync(stagedPath)).toBe(true);
    await expect(manager.listServiceApps()).resolves.toMatchObject({
      diagnostics: [{
        appId: "other",
        stagedPath,
        message: expect.stringContaining("identity 不匹配"),
      }],
      entries: [],
    });
  });
});
