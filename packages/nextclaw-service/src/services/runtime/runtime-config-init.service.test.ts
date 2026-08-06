import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initializeConfigIfMissing } from "./runtime-config-init.service.js";

describe("initializeConfigIfMissing", () => {
  it("creates an immediately usable config with OpenCode Zen free models", () => {
    const dir = mkdtempSync(join(tmpdir(), "nextclaw-runtime-init-"));
    const configPath = join(dir, "config.json");

    expect(initializeConfigIfMissing(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      agents: {
        defaults: {
          model: string;
        };
      };
      providers: {
        nextclaw: {
          enabled: boolean;
          apiKey: string;
        };
        opencode: {
          enabled: boolean;
          apiKey: string;
          models: string[];
        };
      };
    };

    expect(config.providers.nextclaw.enabled).toBe(false);
    expect(config.providers.nextclaw.apiKey).toMatch(/^nc_free_/);
    expect(config.agents.defaults.model).toBe("opencode/big-pickle");
    expect(config.providers.opencode.enabled).toBe(true);
    expect(config.providers.opencode.apiKey).toBe("");
    expect(config.providers.opencode.models).toContain("opencode/big-pickle");
    expect(initializeConfigIfMissing(configPath)).toBe(false);
  });
});
