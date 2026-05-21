import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import type { LlmProviderManager } from "@nextclaw/kernel";

const tempDirs: string[] = [];
const testConnectionMock = vi.fn(async (_params: { maxTokens?: number }) => {});

import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";
import type { UiKernelHost } from "./types/router-options.types.js";

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-provider-probe-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
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

    const app = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
      kernel: {
        agentRunRequestManager: {} as never,
        agentRuntimeManager: {} as never,
        assetStore: {} as never,
        ingress: {} as never,
        ncpSessionApi: {} as never,
        llmProviders: {
          testConnection: testConnectionMock,
        } as unknown as LlmProviderManager,
      } satisfies UiKernelHost,
    });

    const response = await app.request("http://localhost/api/config/providers/openai/test", {
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
});
