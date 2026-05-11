import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import type * as NextclawCoreModule from "@nextclaw/core";

const tempDirs: string[] = [];
const chatMock = vi.fn(async (params: { maxTokens?: number }) => {
  return {
    content: "pong",
    toolCalls: [],
    finishReason: "stop",
    usage: {},
    maxTokens: params.maxTokens
  };
});

vi.mock("@nextclaw/core", async () => {
  const actual = await vi.importActual<typeof NextclawCoreModule>("@nextclaw/core");
  return {
    ...actual,
    LiteLLMProvider: class MockLiteLLMProvider extends actual.LiteLLMProvider {
      chat = chatMock;
    }
  };
});

import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

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
    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(Number(chatMock.mock.calls[0]?.[0]?.maxTokens ?? 0)).toBeGreaterThanOrEqual(16);
  });
});
