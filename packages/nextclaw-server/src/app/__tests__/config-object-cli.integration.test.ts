import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import { ConfigSchema, loadConfig, saveConfig, resolveProviderRuntime } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { describe, expect, it, vi } from "vitest";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

const execute = promisify(execFile);
const cliRoot = fileURLToPath(new URL("../../../../nextclaw/", import.meta.url));

async function createFixture() {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-config-cli-"));
  const configPath = join(home, "config.json");
  const runHome = join(home, "run");
  mkdirSync(runHome);
  const initial = ConfigSchema.parse({});
  saveConfig(initial, configPath);
  vi.stubEnv("NEXTCLAW_HOME", home);
  vi.stubEnv("NEXTCLAW_RUN_HOME", runHome);
  vi.resetModules();
  const { createUiRouter } = await import("@nextclaw-server/app/router.js");
  const kernel = createRouterTestKernel();
  const testConnection = vi.fn(async () => undefined);
  const discoverModels = vi.fn(async () => ({ models: ["demo"], source: "provider" as const }));
  Object.assign(kernel.llmProviders, { testConnection, discoverModels });
  let applied = initial;
  const applyLiveConfigReload = vi.fn(async () => { applied = loadConfig(configPath); });
  const router = createUiRouter({ kernel, configPath, appEventBus: new EventBus(), applyLiveConfigReload });
  const server = serve({ fetch: router.fetch, hostname: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  writeFileSync(join(runHome, "ui-runtime.json"), JSON.stringify({ pid: process.pid, uiUrl: `http://127.0.0.1:${address.port}` }));
  const cli = async (...args: string[]) => {
    const { stdout } = await execute(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [
      "exec", "tsx", "--tsconfig", "../../scripts/dev/dev-runtime.tsconfig.json", "src/cli/app/index.ts", ...args, "--json",
    ], { cwd: cliRoot, env: { ...process.env, NEXTCLAW_CLI_TEST_KEY: "test-secret-not-a-real-key" }, timeout: 20_000 });
    return JSON.parse(stdout);
  };
  return {
    cli, configPath, initial, testConnection, applyLiveConfigReload,
    get applied() { return applied; },
    close: async () => {
    if ("closeAllConnections" in server) server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
    },
  };
}

describe("config CLI through the running HTTP API", () => {
  it("discovers the host, authenticates, persists provider/model/search changes and awaits application", async () => {
    const fixture = await createFixture();
    const { cli, configPath, initial, testConnection, applyLiveConfigReload } = fixture;
    try {
      const created = await cli("providers", "add", "office", "--type", "openai", "--api-key-env", "NEXTCLAW_CLI_TEST_KEY");
      expect(created.provider.apiKeySet).toBe(true);
      expect(JSON.stringify(created)).not.toContain("test-secret-not-a-real-key");
      expect(fixture.applied.providers.office.apiKey).toBe("test-secret-not-a-real-key");
      const discovered = await cli("providers", "models", "discover", "office");
      expect(discovered.models).toEqual(["demo"]);
      const modelsBefore = loadConfig(configPath).providers.office.models;
      expect(modelsBefore).not.toEqual(["demo"]);
      await cli("providers", "models", "set", "office", "office/demo");
      await cli("providers", "models", "configure", "office", "--vision", "office/demo=true", "--thinking", "office/demo=off,high", "--thinking-default", "office/demo=high");
      expect(fixture.applied.providers.office.modelConfig["office/demo"]).toEqual({ vision: true, thinking: { supported: ["off", "high"], default: "high" } });
      const tested = await cli("providers", "test", "office", "--model", "office/demo");
      expect(tested.success).toBe(true);
      expect(testConnection).toHaveBeenCalledWith(expect.objectContaining({ defaultModel: "openai/demo", apiKey: "test-secret-not-a-real-key" }));
      await cli("models", "set", "office/demo");
      expect(await cli("models", "show")).toEqual({ model: "office/demo" });
      expect(resolveProviderRuntime(fixture.applied).providerName).toBe("office");
      await cli("providers", "update", "office", "--name", "Office");
      expect(fixture.applied.providers.office.models).toEqual(["office/demo"]);
      await cli("providers", "disable", "office");
      expect((await cli("providers", "show", "office")).enabled).toBe(false);
      await cli("providers", "enable", "office");
      expect(fixture.applied.providers.office.enabled).toBe(true);
      await cli("search", "provider", "exa", "--api-key-env", "NEXTCLAW_CLI_TEST_KEY");
      await cli("search", "configure", "--provider", "exa", "--enabled-provider", "exa", "--max-results", "20");
      const search = await cli("search", "show");
      expect(search).toMatchObject({ provider: "exa", enabledProviders: ["exa"], defaults: { maxResults: 20 } });
      expect(search.providers.exa.apiKeySet).toBe(true);
      expect(JSON.stringify(search)).not.toContain("test-secret-not-a-real-key");
      expect(fixture.applied.search.provider).toBe("exa");
      expect(fixture.applied.channels).toEqual(initial.channels);
      await cli("providers", "remove", "office");
      expect(loadConfig(configPath).providers.office).toBeUndefined();
      await expect(cli("providers", "show", "office")).rejects.toThrow();
      expect(applyLiveConfigReload).toHaveBeenCalled();
    } finally {
      await fixture.close();
    }
  }, 120_000);
});
