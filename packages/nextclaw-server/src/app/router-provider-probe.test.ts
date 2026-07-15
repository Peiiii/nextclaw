import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import type { LlmProviderManager } from "@nextclaw/kernel";

const tempDirs: string[] = [];
const testConnectionMock = vi.fn(async (_params: { defaultModel: string; maxTokens?: number }) => {});

import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";
import type { UiKernelHost } from "./types/router-options.types.js";

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-provider-probe-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

function createProviderProbeApp(configPath: string) {
  return createUiRouter({
    configPath,
    appEventBus: new EventBus(),
    kernel: {
      assetStore: {} as never,
      eventBus: new EventBus(),
      ingress: {} as never,
      isSessionRunning: () => false,
      listSessionTypes: async () => ({ defaultType: "native", options: [] }),
      sessionManager: {} as never,
      panelAppManager: {
        listPanelApps: async () => ({ workspacePath: "", panelsPath: "", entries: [] }),
        getPanelAppContent: async () => {
          throw new Error("not used");
        },
      } as never,
      preferenceManager: {
        getPreference: async () => null,
        setPreference: async () => {
          throw new Error("not used");
        },
        deletePreference: async () => false,
      } as never,
      serviceAppManager: {} as never,
      llmProviders: { testConnection: testConnectionMock } as unknown as LlmProviderManager,
    } satisfies UiKernelHost,
  });
}

afterEach(() => {
  vi.clearAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("provider connection probe route", () => {
  it("uses maxTokens >= 16 when probing provider connection", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createProviderProbeApp(configPath);
    await app.request("http://localhost/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerType: "openai" })
    });

    const response = await app.request("http://localhost/api/providers/openai/test", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        apiKey: "sk_test_probe",
        model: "gpt-5.2-codex"
      })
    });

    expect(response.status).toBe(200);
    expect(testConnectionMock).toHaveBeenCalledTimes(1);
    expect(Number(testConnectionMock.mock.calls[0]?.[0]?.maxTokens ?? 0)).toBeGreaterThanOrEqual(16);
  });

  it("does not rewrite provider instance ids inside a provider-local model id", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createProviderProbeApp(configPath);
    await app.request("http://localhost/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId: "openrouter-2", providerType: "openrouter" })
    });

    const response = await app.request("http://localhost/api/providers/openrouter-2/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKey: "sk_test_probe",
        model: "bedrock/openrouter-2/claude-fable-5"
      })
    });

    expect(response.status).toBe(200);
    expect(testConnectionMock).toHaveBeenCalledTimes(1);
    expect(testConnectionMock.mock.calls[0]?.[0]?.defaultModel).toBe("bedrock/openrouter-2/claude-fable-5");
  });
});
