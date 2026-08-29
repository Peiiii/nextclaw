import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, type Config } from "@nextclaw/core";
import { ServiceAppDevService } from "./service-app-dev.service.js";

const tempDirs: string[] = [];
const mcpFixturePath = path.resolve(
  import.meta.dirname,
  "../../../../../nextclaw-mcp/tests/fixtures/mock-mcp-server.utils.mjs",
);

async function createServiceApp(options: { requiresDataDirectory?: boolean } = {}): Promise<string> {
  const root = path.join(
    tmpdir(),
    `nextclaw-service-app-dev-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  tempDirs.push(root);
  const appPath = path.join(root, "notes");
  await mkdir(appPath, { recursive: true });
  await writeFile(
    path.join(appPath, "service-app.json"),
    `${JSON.stringify({
      id: "notes",
      title: "Notes",
      protocol: "mcp",
      command: process.execPath,
      args: [
        mcpFixturePath,
        "stdio",
        ...(options.requiresDataDirectory ? ["require-data-dir"] : []),
      ],
      actions: {
        echo: { risk: "read" },
      },
    }, null, 2)}\n`,
  );
  return appPath;
}

async function createPortablePackage(serviceIds = ["example-dev-service"]): Promise<string> {
  const root = path.join(
    tmpdir(),
    `nextclaw-portable-dev-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  tempDirs.push(root);
  for (const serviceId of serviceIds) {
    const servicePath = path.join(root, "service-components", serviceId);
    await mkdir(servicePath, { recursive: true });
    await writeFile(path.join(servicePath, "service-app.json"), `${JSON.stringify({
      id: serviceId,
      title: serviceId,
      protocol: "wasi-component",
      component: { entry: "service.wasm" },
      actions: { counter_read: { risk: "read" } },
    }, null, 2)}\n`);
    await writeFile(path.join(servicePath, "service.wasm"), "component");
  }
  await writeFile(path.join(root, "manifest.json"), `${JSON.stringify({
    schemaVersion: 2,
    id: "example.dev",
    name: "Portable Dev",
    version: "0.1.0",
    description: "Portable development fixture",
    runtime: { profile: "wasi" },
    distribution: { mode: "universal" },
    permissions: { storage: { namespace: "example-dev" } },
    components: serviceIds.map((serviceId) => ({
      kind: "service",
      path: `service-components/${serviceId}`,
    })),
  }, null, 2)}\n`);
  return root;
}

function createConfig(): Config {
  return ConfigSchema.parse({
    agents: {
      defaults: {
        workspace: tmpdir(),
      },
    },
  });
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe("ServiceAppDevService", () => {
  it("starts a real MCP-backed service app and reports matched actions", async () => {
    const appPath = await createServiceApp();

    const report = await new ServiceAppDevService({
      getConfig: createConfig,
    }).inspect(appPath);

    expect(report.ok).toBe(true);
    expect(report.app).toEqual(expect.objectContaining({
      id: "notes",
      status: "running",
    }));
    expect(report.actions).toEqual([
      expect.objectContaining({
        id: "notes.echo",
        name: "echo",
        runtimeState: "matched",
      }),
    ]);
  });

  it("calls a real MCP-backed service app action", async () => {
    const appPath = await createServiceApp();

    const report = await new ServiceAppDevService({
      getConfig: createConfig,
    }).call(appPath, "echo", {});

    expect(report.ok).toBe(true);
    expect(report.actionId).toBe("notes.echo");
    expect(report.result).toEqual(expect.objectContaining({
      content: [expect.objectContaining({ text: "echo:ok" })],
    }));
  });

  it("provides an isolated temporary data directory to the real MCP runtime", async () => {
    const appPath = await createServiceApp({ requiresDataDirectory: true });

    const report = await new ServiceAppDevService({
      getConfig: createConfig,
    }).call(appPath, "echo", {});

    expect(report.ok).toBe(true);
    expect(report.result).toEqual(expect.objectContaining({
      content: [expect.objectContaining({ text: "data-dir:ok" })],
    }));
  });

  it("resets only the confirmed development instance before starting", async () => {
    const appPath = await createServiceApp();
    const appHome = path.join(tempDirs[0]!, "app-home");
    const previousAppHome = process.env.NEXTCLAW_APP_HOME;
    process.env.NEXTCLAW_APP_HOME = appHome;
    try {
      const service = new ServiceAppDevService({ getConfig: createConfig });
      const first = await service.inspect(appPath);
      const sentinel = path.join(first.app!.storage!.dataDirectory, "sentinel.txt");
      await writeFile(sentinel, "old", "utf8");

      const rejected = await service.inspect(appPath, {
        resetData: true,
        confirmAppId: "wrong",
      });
      expect(rejected.ok).toBe(false);
      expect(rejected.issues).toEqual([
        expect.objectContaining({ code: "service.data.confirmationMismatch" }),
      ]);
      await expect(access(sentinel)).resolves.toBeUndefined();

      const reset = await service.inspect(appPath, {
        resetData: true,
        confirmAppId: "notes",
      });
      expect(reset.ok).toBe(true);
      await expect(access(sentinel)).rejects.toThrow();
      expect(reset.app?.storage?.instanceDirectory)
        .toBe(first.app?.storage?.instanceDirectory);
    } finally {
      if (previousAppHome === undefined) delete process.env.NEXTCLAW_APP_HOME;
      else process.env.NEXTCLAW_APP_HOME = previousAppHome;
    }
  });

  it("accepts a schema v2 package target and selects its only Service component", async () => {
    const packagePath = await createPortablePackage();
    const previousAppHome = process.env.NEXTCLAW_APP_HOME;
    process.env.NEXTCLAW_APP_HOME = path.join(packagePath, "app-home");
    try {
      const report = await new ServiceAppDevService({
        getConfig: createConfig,
        runtimeService: {
          getStatus: () => ({ status: "running" }),
          listActions: async () => [{
            id: "example-dev-service.counter_read",
            appId: "example-dev-service",
            name: "counter_read",
            risk: "read",
          }],
          invokeAction: async () => ({ counter: 0 }),
          dispose: async () => {},
        },
      }).inspect(packagePath);

      expect(report.ok).toBe(true);
      expect(report.app?.id).toBe("example-dev-service");
      expect(report.actions).toEqual([
        expect.objectContaining({ name: "counter_read", runtimeState: "matched" }),
      ]);
    } finally {
      if (previousAppHome === undefined) delete process.env.NEXTCLAW_APP_HOME;
      else process.env.NEXTCLAW_APP_HOME = previousAppHome;
    }
  });

  it("requires an explicit component when a package contains multiple Services", async () => {
    const packagePath = await createPortablePackage([
      "example-dev-service",
      "example-dev-secondary",
    ]);

    const report = await new ServiceAppDevService({ getConfig: createConfig }).inspect(packagePath);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: "service.package.componentRequired",
        fixHint: expect.stringContaining("example-dev-secondary"),
      }),
    ]);
  });
});
