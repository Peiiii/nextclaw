import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-provider-enabled-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("provider enabled state route", () => {
  it("exposes built-in nextclaw provider as disabled by default for empty config", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);

    const configPayload = await configResponse.json() as {
      ok: true;
      data: {
        providers: Record<string, { enabled: boolean; apiKeySet: boolean }>;
      };
    };
    expect(configPayload.data.providers.nextclaw.enabled).toBe(false);
    expect(configPayload.data.providers.nextclaw.apiKeySet).toBe(true);
  });

  it("persists provider enabled state and exposes it in config view", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const updateResponse = await app.request("http://localhost/api/config/providers/openai", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        enabled: false,
        apiKey: "sk-disabled"
      })
    });
    expect(updateResponse.status).toBe(200);

    const updatePayload = await updateResponse.json() as {
      ok: true;
      data: {
        enabled: boolean;
        apiKeySet: boolean;
      };
    };
    expect(updatePayload.data.enabled).toBe(false);
    expect(updatePayload.data.apiKeySet).toBe(true);

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);

    const configPayload = await configResponse.json() as {
      ok: true;
      data: {
        providers: Record<string, { enabled: boolean; apiKeySet: boolean }>;
      };
    };
    expect(configPayload.data.providers.openai.enabled).toBe(false);
    expect(configPayload.data.providers.openai.apiKeySet).toBe(true);
  });
});
