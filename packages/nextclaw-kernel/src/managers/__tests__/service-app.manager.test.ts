import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
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

function createConfigManager(workspacePath: string): ConfigManager {
  const configPath = join(createTempDir(), "config.json");
  saveConfig(
    ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: workspacePath,
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

const mcpFixturePath = resolve(
  import.meta.dirname,
  "../../../../nextclaw-mcp/tests/fixtures/mock-mcp-server.mjs",
);

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
  actions: ServiceAction | ServiceAction[],
  status: Pick<ServiceAppRecord, "lastFailedAt" | "lastReadyAt" | "lastStartedAt" | "status"> = { status: "idle" },
) {
  const actionList = Array.isArray(actions) ? actions : [actions];
  return {
    getStatus: vi.fn(() => status),
    listActions: vi.fn(async () => actionList),
    invokeAction: vi.fn(async () => ({ ok: true })),
    restart: vi.fn(async () => {}),
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

describe("ServiceAppManager runtime env", () => {
  it("runs a node command service app when the parent process PATH is minimal", async () => {
    const originalPath = process.env.PATH;
    const originalNodeOptions = process.env.NODE_OPTIONS;
    process.env.PATH = ["/usr/bin", "/bin"].join(":");
    process.env.NODE_OPTIONS = "--require=/tmp/nextclaw-missing-node-options-hook.cjs";
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath, {
      command: "node",
      args: [mcpFixturePath, "stdio"],
      actions: {
        echo: { risk: "read" },
      },
    });
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };

    try {
      await manager.grantServiceAction("notes.echo", {
        caller,
        declaredActions: ["notes.echo"],
      });
      await expect(manager.invokeServiceAction("notes.echo", {
        caller,
        declaredActions: ["notes.echo"],
      })).resolves.toEqual({
        actionId: "notes.echo",
        result: expect.objectContaining({
          content: [expect.objectContaining({ text: "echo:ok" })],
        }),
      });
    } finally {
      await manager.dispose();
      if (originalPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = originalPath;
      }
      if (originalNodeOptions === undefined) {
        delete process.env.NODE_OPTIONS;
      } else {
        process.env.NODE_OPTIONS = originalNodeOptions;
      }
    }
  });
});

describe("ServiceAppManager", () => {
  it("discovers and invokes a real MCP-backed service app after grant", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath, {
      command: process.execPath,
      args: [mcpFixturePath, "stdio"],
      actions: {
        echo: { risk: "read" },
      },
    });
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };

    try {
      await expect(manager.listServiceActions({
        caller,
        declaredActions: ["notes.echo"],
      })).resolves.toEqual([
        expect.objectContaining({
          id: "notes.echo",
          appId: "notes",
          name: "echo",
          risk: "read",
          grantState: "not-granted",
        }),
      ]);
      await manager.grantServiceAction("notes.echo", {
        caller,
        declaredActions: ["notes.echo"],
      });
      await expect(manager.invokeServiceAction("notes.echo", {
        caller,
        declaredActions: ["notes.echo"],
      })).resolves.toEqual({
        actionId: "notes.echo",
        result: expect.objectContaining({
          content: [expect.objectContaining({ text: "echo:ok" })],
        }),
      });
    } finally {
      await manager.dispose();
    }
  });

  it("lists service apps from workspace directories with manifests", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath);
    const action: ServiceAction = {
      id: "notes.read",
      appId: "notes",
      name: "read",
      risk: "read",
    };
    const runtime = createRuntime(action);
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      runtimeService: runtime,
    });

    const list = await manager.listServiceApps();

    expect(list.workspacePath).toBe(workspacePath);
    expect(list.serviceAppsPath).toBe(join(workspacePath, "service-apps"));
    expect(list.entries[0]).toEqual(expect.objectContaining({
      args: ["server.mjs"],
      command: "node",
      cwd: join(workspacePath, "service-apps", "notes"),
      id: "notes",
      manifestPath: join(workspacePath, "service-apps", "notes", "service-app.json"),
      title: "Notes",
      enabled: true,
      protocol: "mcp",
      status: "idle",
    }));
  });

  it("skips directories that do not contain a service app manifest yet", async () => {
    const workspacePath = createTempDir();
    mkdirSync(join(workspacePath, "service-apps", "mood-tracker"), { recursive: true });
    writeServiceApp(workspacePath);
    const action: ServiceAction = {
      id: "notes.read",
      appId: "notes",
      name: "read",
      risk: "read",
    };
    const runtime = createRuntime(action);
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      runtimeService: runtime,
    });

    const list = await manager.listServiceApps();

    expect(list.entries).toHaveLength(1);
    expect(list.entries[0]?.id).toBe("notes");
  });

  it("shows a failed service app record when the manifest exists but is invalid", async () => {
    const workspacePath = createTempDir();
    const appPath = join(workspacePath, "service-apps", "bad-json");
    mkdirSync(appPath, { recursive: true });
    writeFileSync(join(appPath, "service-app.json"), "{");
    const runtime = createRuntime({
      id: "notes.read",
      appId: "notes",
      name: "read",
      risk: "read",
    });
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      runtimeService: runtime,
    });

    const list = await manager.listServiceApps();

    expect(list.entries).toEqual([
      expect.objectContaining({
        cwd: appPath,
        id: "bad-json",
        status: "failed",
        lastError: expect.stringContaining("not valid JSON"),
      }),
    ]);
  });

  it("requires declared panel action grants before invoking a service action", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath);
    const action: ServiceAction = {
      id: "notes.read",
      appId: "notes",
      name: "read",
      risk: "read",
    };
    const runtime = createRuntime(action);
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      runtimeService: runtime,
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };
    const request = {
      caller,
      declaredActions: ["notes.read"],
      input: { path: "memory.md" },
    };

    await expect(manager.invokeServiceAction("notes.read", request)).rejects.toMatchObject({
      code: "AUTHORIZATION_REQUIRED",
    } satisfies Partial<ServiceAppError>);
    expect(runtime.listActions).not.toHaveBeenCalled();
    expect(runtime.invokeAction).not.toHaveBeenCalled();

    await expect(manager.grantServiceAction("notes.read", {
      caller,
      declaredActions: ["notes.read"],
    })).resolves.toEqual(expect.objectContaining({
      actionId: "notes.read",
      caller,
      risk: "read",
    }));
    await expect(manager.invokeServiceAction("notes.read", request)).resolves.toEqual({
      actionId: "notes.read",
      result: { ok: true },
    });
    expect(runtime.listActions).not.toHaveBeenCalled();
    expect(runtime.invokeAction).toHaveBeenCalledWith(expect.objectContaining({
      actionName: "read",
      input: { path: "memory.md" },
    }));
  });

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
    });

    expect(existsSync(appPath)).toBe(false);
    expect(runtime.restart).toHaveBeenCalledWith("notes");
    await expect(manager.listServiceActionGrants()).resolves.toEqual([]);
    await expect(manager.getServiceApp("notes")).rejects.toMatchObject({
      code: "SERVICE_APP_NOT_FOUND",
    } satisfies Partial<ServiceAppError>);
  });
});

describe("ServiceAppManager batch action grants", () => {
  it("grants multiple declared service actions without starting the runtime", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath, {
      actions: {
        read: { risk: "read" },
        write: { risk: "write" },
      },
    });
    const runtime = createRuntime([
      {
        id: "notes.read",
        appId: "notes",
        name: "read",
        risk: "read",
      },
      {
        id: "notes.write",
        appId: "notes",
        name: "write",
        risk: "write",
      },
    ]);
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      runtimeService: runtime,
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };

    await expect(manager.grantServiceActions(["notes.read", "notes.write", "notes.read"], {
      caller,
      declaredActions: ["notes.read", "notes.write"],
    })).resolves.toEqual([
      expect.objectContaining({ actionId: "notes.read", risk: "read" }),
      expect.objectContaining({ actionId: "notes.write", risk: "write" }),
    ]);

    await expect(manager.listServiceActions({
      caller,
      declaredActions: ["notes.read", "notes.write"],
    })).resolves.toEqual([
      expect.objectContaining({ id: "notes.read", grantState: "granted" }),
      expect.objectContaining({ id: "notes.write", grantState: "granted" }),
    ]);
    expect(runtime.listActions).not.toHaveBeenCalled();
  });

  it("rejects undeclared actions without writing partial grants", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath, {
      actions: {
        read: { risk: "read" },
        write: { risk: "write" },
      },
    });
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      runtimeService: createRuntime([]),
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };

    await expect(manager.grantServiceActions(["notes.read", "notes.write"], {
      caller,
      declaredActions: ["notes.read"],
    })).rejects.toMatchObject({
      code: "SERVICE_APP_ACTION_NOT_DECLARED",
    } satisfies Partial<ServiceAppError>);
    await expect(manager.listServiceActionGrants()).resolves.toEqual([]);
  });
});

describe("ServiceAppManager action catalog", () => {
  it("marks grant state from the caller and panel declaration", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath);
    const action: ServiceAction = {
      id: "notes.read",
      appId: "notes",
      name: "read",
      risk: "read",
    };
    const runtime = createRuntime(action);
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      runtimeService: runtime,
    });
    const caller: ServiceActionCaller = { surface: "panel-app", appId: "todo-panel" };

    await expect(manager.listServiceActions({
      caller,
      declaredActions: [],
    })).resolves.toEqual([
      expect.objectContaining({ id: "notes.read", grantState: "not-declared" }),
    ]);
    expect(runtime.listActions).not.toHaveBeenCalled();
    await expect(manager.listServiceActions({
      caller,
      declaredActions: ["notes.read"],
    })).resolves.toEqual([
      expect.objectContaining({ id: "notes.read", grantState: "not-granted" }),
    ]);

    await manager.grantServiceAction("notes.read", {
      caller,
      declaredActions: ["notes.read"],
    });

    await expect(manager.listServiceActionGrants()).resolves.toEqual([
      expect.objectContaining({ actionId: "notes.read", caller }),
    ]);

    await expect(manager.listServiceActions({
      caller,
      declaredActions: ["notes.read"],
    })).resolves.toEqual([
      expect.objectContaining({ id: "notes.read", grantState: "granted" }),
    ]);
  });

  it("discovers runtime actions explicitly and marks manifest mismatches", async () => {
    const workspacePath = createTempDir();
    writeServiceApp(workspacePath, {
      actions: {
        read: { risk: "read" },
        write: { risk: "write" },
      },
    });
    const runtime = createRuntime([
      {
        id: "notes.read",
        appId: "notes",
        name: "read",
        description: "Runtime read",
        inputSchema: { type: "object" },
        risk: "read",
      },
      {
        id: "notes.extra",
        appId: "notes",
        name: "extra",
        risk: "dangerous",
      },
    ]);
    const manager = new ServiceAppManager({
      configManager: createConfigManager(workspacePath),
      runtimeService: runtime,
    });

    await expect(manager.discoverServiceAppActions("notes")).resolves.toEqual([
      expect.objectContaining({
        id: "notes.extra",
        runtimeState: "undeclared",
        risk: "dangerous",
      }),
      expect.objectContaining({
        id: "notes.read",
        description: "Runtime read",
        inputSchema: { type: "object" },
        runtimeState: "matched",
      }),
      expect.objectContaining({
        id: "notes.write",
        runtimeState: "missing",
        risk: "write",
      }),
    ]);
    expect(runtime.listActions).toHaveBeenCalledTimes(1);
  });
});
