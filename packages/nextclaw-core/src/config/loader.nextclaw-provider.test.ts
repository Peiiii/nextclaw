import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./loader.js";

describe("loadConfig nextclaw built-in provider bootstrap", () => {
  it("auto-generates and persists a disabled nextclaw provider for empty config", () => {
    const dir = mkdtempSync(join(tmpdir(), "nextclaw-config-nextclaw-"));
    const configPath = join(dir, "config.json");

    const first = loadConfig(configPath);
    const second = loadConfig(configPath);

    expect(first.providers.nextclaw.enabled).toBe(false);
    expect(first.providers.nextclaw.apiKey).toMatch(/^nc_free_/);
    expect(second.providers.nextclaw.enabled).toBe(false);
    expect(second.providers.nextclaw.apiKey).toBe(first.providers.nextclaw.apiKey);
  });

  it("migrates legacy brave web search config into the new search config", () => {
    const dir = mkdtempSync(join(tmpdir(), "nextclaw-config-search-"));
    const configPath = join(dir, "config.json");

    writeFileSync(configPath, JSON.stringify({
      tools: {
        web: {
          search: {
            apiKey: "brave_legacy_key",
            maxResults: 7
          }
        }
      }
    }, null, 2));

    const config = loadConfig(configPath);

    expect(config.search.provider).toBe("bocha");
    expect(config.search.enabledProviders).toEqual(["bocha"]);
    expect(config.search.defaults.maxResults).toBe(7);
    expect(config.search.providers.brave.apiKey).toBe("brave_legacy_key");
  });
});
