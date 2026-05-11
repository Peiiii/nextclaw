import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";
import { EventBus } from "@nextclaw/shared";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-search-test-"));
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

describe("search config route", () => {
  it("updates tavily config and exposes search metadata", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
    });

    const updateResponse = await app.request("http://localhost/api/config/search", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        provider: "tavily",
        enabledProviders: ["tavily", "brave"],
        defaults: {
          maxResults: 12
        },
        providers: {
          tavily: {
            apiKey: "tvly_test_key",
            searchDepth: "advanced",
            includeAnswer: true
          }
        }
      })
    });
    expect(updateResponse.status).toBe(200);
    const updatePayload = await updateResponse.json() as {
      ok: true;
      data: {
        provider: string;
        enabledProviders: string[];
        defaults: { maxResults: number };
        providers: {
          bocha: { enabled: boolean };
          tavily: { apiKeySet: boolean; searchDepth?: string; includeAnswer?: boolean; enabled: boolean };
          brave: { enabled: boolean };
        };
      };
    };
    expect(updatePayload.data.provider).toBe("tavily");
    expect(updatePayload.data.enabledProviders).toEqual(["tavily", "brave"]);
    expect(updatePayload.data.defaults.maxResults).toBe(12);
    expect(updatePayload.data.providers.tavily.apiKeySet).toBe(true);
    expect(updatePayload.data.providers.bocha.enabled).toBe(false);
    expect(updatePayload.data.providers.tavily.enabled).toBe(true);
    expect(updatePayload.data.providers.brave.enabled).toBe(true);
    expect(updatePayload.data.providers.tavily.searchDepth).toBe("advanced");
    expect(updatePayload.data.providers.tavily.includeAnswer).toBe(true);

    const configResponse = await app.request("http://localhost/api/config");
    expect(configResponse.status).toBe(200);
    const configPayload = await configResponse.json() as {
      ok: true;
      data: {
        search: {
          provider: string;
          enabledProviders: string[];
          defaults: { maxResults: number };
        };
      };
    };
    expect(configPayload.data.search.provider).toBe("tavily");
    expect(configPayload.data.search.enabledProviders).toEqual(["tavily", "brave"]);
    expect(configPayload.data.search.defaults.maxResults).toBe(12);

    const metaResponse = await app.request("http://localhost/api/config/meta");
    expect(metaResponse.status).toBe(200);
    const metaPayload = await metaResponse.json() as {
      ok: true;
      data: {
        search: Array<{ name: string }>;
      };
    };
    expect(metaPayload.data.search.map((entry) => entry.name)).toEqual(["bocha", "tavily", "brave"]);
  });
});
