import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initializeConfigIfMissing } from "./runtime-config-init.service.js";

describe("initializeConfigIfMissing", () => {
  it("creates a config with the built-in nextclaw provider disabled by default", () => {
    const dir = mkdtempSync(join(tmpdir(), "nextclaw-runtime-init-"));
    const configPath = join(dir, "config.json");

    expect(initializeConfigIfMissing(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      providers: {
        nextclaw: {
          enabled: boolean;
          apiKey: string;
        };
      };
    };

    expect(config.providers.nextclaw.enabled).toBe(false);
    expect(config.providers.nextclaw.apiKey).toMatch(/^nc_free_/);
    expect(initializeConfigIfMissing(configPath)).toBe(false);
  });
});
