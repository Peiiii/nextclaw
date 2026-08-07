import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import { createUiRouter } from "@nextclaw-server/app/router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-provider-discovery-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

function createTestApp(
  configPath: string,
  discoverModels: ReturnType<typeof vi.fn>,
  getSnapshot = vi.fn(() => ({
    refreshIntervalMs: 43_200_000,
    refreshing: false,
    lastRefreshStartedAt: "2026-08-07T00:00:00.000Z",
    lastRefreshCompletedAt: "2026-08-07T00:00:01.000Z",
    providers: {},
  })),
) {
  return createUiRouter({
    kernel: createRouterTestKernel({
      llmProviders: { discoverModels } as never,
      providerModelCatalog: { getSnapshot } as never,
    }),
    configPath,
    appEventBus: new EventBus(),
  });
}

async function createOpenAiProvider(app: ReturnType<typeof createUiRouter>): Promise<void> {
  const response = await app.request("http://localhost/api/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ providerType: "openai" }),
  });
  expect(response.status).toBe(200);
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

describe("provider model discovery route", () => {
  it("reads the background catalog snapshot without starting external discovery", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const discoverModels = vi.fn();
    const snapshot = {
      refreshIntervalMs: 43_200_000,
      refreshing: false,
      lastRefreshStartedAt: "2026-08-07T00:00:00.000Z",
      lastRefreshCompletedAt: "2026-08-07T00:00:01.000Z",
      providers: {
        opencode: {
          providerId: "opencode",
          models: ["big-pickle", "deepseek-v4-flash-free"],
          source: "catalog" as const,
          fetchedAt: "2026-08-07T00:00:00.500Z",
          lastError: null,
        },
      },
    };
    const getSnapshot = vi.fn(() => snapshot);
    const app = createTestApp(configPath, discoverModels, getSnapshot);

    const response = await app.request("http://localhost/api/provider-model-catalog");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, data: snapshot });
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(discoverModels).not.toHaveBeenCalled();
  });

  it("discovers the default OpenCode catalog without a user API key", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const discoverModels = vi.fn(async () => ({
      models: ["big-pickle"],
      source: "catalog" as const,
    }));
    const app = createTestApp(configPath, discoverModels);
    const createResponse = await app.request("http://localhost/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerType: "opencode" }),
    });
    expect(createResponse.status).toBe(200);

    const response = await app.request("http://localhost/api/providers/opencode/models/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(200);
    expect(discoverModels).toHaveBeenCalledWith(expect.objectContaining({
      providerName: "opencode",
      apiKey: "public",
      apiBase: "https://opencode.ai/zen/v1",
    }));
  });

  it("passes the unsaved provider draft through the assembled route and returns the exact contract", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const discoverModels = vi.fn(async () => ({
      models: ["gpt-5", "gpt-4.1"],
      source: "provider" as const,
    }));
    const app = createTestApp(configPath, discoverModels);
    await createOpenAiProvider(app);

    const response = await app.request("http://localhost/api/providers/openai/models/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKey: "draft-key",
        apiBase: "https://draft.example.com/v1",
        extraHeaders: { "X-Tenant": "team-a" },
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: true;
      data: { provider: string; models: string[]; source: string; fetchedAt: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data).toEqual({
      provider: "openai",
      models: ["gpt-5", "gpt-4.1"],
      source: "provider",
      fetchedAt: expect.any(String),
    });
    expect(discoverModels).toHaveBeenCalledWith({
      providerName: "openai",
      apiKey: "draft-key",
      apiBase: "https://draft.example.com/v1",
      extraHeaders: { "X-Tenant": "team-a" },
    });

    const providersResponse = await app.request("http://localhost/api/providers");
    const providersPayload = await providersResponse.json() as {
      ok: true;
      data: { providers: Record<string, { models?: string[] }> };
    };
    expect(providersPayload.data.providers.openai?.models).not.toContain("openai/gpt-4.1");
  });

  it("returns stable errors for unknown providers and upstream failures", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const discoverModels = vi.fn(async () => {
      throw new Error("Provider model discovery failed with HTTP 401 Unauthorized");
    });
    const app = createTestApp(configPath, discoverModels);

    const unknown = await app.request("http://localhost/api/providers/missing/models/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(unknown.status).toBe(404);

    await createOpenAiProvider(app);
    const failed = await app.request("http://localhost/api/providers/openai/models/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "PROVIDER_MODEL_DISCOVERY_FAILED",
        message: "Provider model discovery failed with HTTP 401 Unauthorized",
      },
    });
  });
});
