import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, loadConfig, saveConfig } from "@nextclaw/core";
import { McpRegistryService } from "@nextclaw/mcp";
import { EventBus } from "@nextclaw/shared";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import { createUiRouter } from "./router.js";

const directories: string[] = [];

function createConfigPath(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-mcp-connection-test-"));
  directories.push(directory);
  return join(directory, "config.json");
}

function requestBody() {
  return {
    name: "custom-server",
    definition: {
      enabled: true,
      transport: { type: "http", url: "https://example.test/mcp", headers: {}, timeoutMs: 15000, verifyTls: true },
      scope: { allAgents: true, agents: [] },
      policy: { trust: "explicit", start: "eager" },
    },
  };
}

const mcpFixturePath = resolve(import.meta.dirname, "../../../nextclaw-mcp/tests/fixtures/mock-mcp-server.utils.mjs");

afterEach(() => {
  while (directories.length > 0) rmSync(directories.pop()!, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("external MCP connection routes", () => {
  it("discovers tools from a real stdio MCP server without persisting it", async () => {
    const configPath = createConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const app = createUiRouter({ kernel: createRouterTestKernel(), configPath, appEventBus: new EventBus() });

    const response = await app.request("http://localhost/api/mcp/servers/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "real-stdio-server",
        definition: {
          enabled: true,
          transport: { type: "stdio", command: process.execPath, args: [mcpFixturePath, "stdio"], cwd: "", env: {}, stderr: "pipe" },
          scope: { allAgents: true, agents: [] },
          policy: { trust: "explicit", start: "eager" },
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { name: "real-stdio-server", accessible: true, toolCount: 1 } });
    expect(loadConfig(configPath).mcp.servers).toEqual({});
  });

  it("tests a connection without persisting it", async () => {
    const configPath = createConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    vi.spyOn(McpRegistryService.prototype, "warmServer").mockResolvedValue({ name: "custom-server", ok: true, toolCount: 3 });
    const app = createUiRouter({ kernel: createRouterTestKernel(), configPath, appEventBus: new EventBus() });

    const response = await app.request("http://localhost/api/mcp/servers/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(requestBody()) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { name: "custom-server", accessible: true, toolCount: 3 } });
    expect(loadConfig(configPath).mcp.servers).toEqual({});
  });

  it("saves a tested-shape manual server and applies the live configuration", async () => {
    const configPath = createConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const applyLiveConfigReload = vi.fn(async () => undefined);
    const app = createUiRouter({ kernel: createRouterTestKernel(), configPath, appEventBus: new EventBus(), applyLiveConfigReload });

    const response = await app.request("http://localhost/api/mcp/servers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(requestBody()) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { name: "custom-server", transport: "http" } });
    expect(loadConfig(configPath).mcp.servers["custom-server"]?.metadata?.source).toBe("manual");
    expect(applyLiveConfigReload).toHaveBeenCalledOnce();
  });

  it("rejects a malformed external MCP without changing configuration", async () => {
    const configPath = createConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const app = createUiRouter({ kernel: createRouterTestKernel(), configPath, appEventBus: new EventBus() });

    const response = await app.request("http://localhost/api/mcp/servers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "bad", definition: { enabled: true, transport: { type: "http" } } }) });

    expect(response.status).toBe(400);
    expect(loadConfig(configPath).mcp.servers).toEqual({});
  });
});
