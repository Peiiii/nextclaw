import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, type Config } from "@nextclaw/core";
import { ServiceAppDevService } from "./service-app-dev.service.js";

const tempDirs: string[] = [];
const mcpFixturePath = path.resolve(
  import.meta.dirname,
  "../../../../../nextclaw-mcp/tests/fixtures/mock-mcp-server.mjs",
);

async function createServiceApp(): Promise<string> {
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
      args: [mcpFixturePath, "stdio"],
      actions: {
        echo: { risk: "read" },
      },
    }, null, 2)}\n`,
  );
  return appPath;
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
});
