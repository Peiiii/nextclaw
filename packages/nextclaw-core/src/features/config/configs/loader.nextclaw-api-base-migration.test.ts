import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./loader.js";

describe("nextclaw apiBase migration", () => {
  it("migrates legacy nextclaw api base to ai-gateway-api domain", () => {
    const dir = mkdtempSync(join(tmpdir(), "nextclaw-config-nextclaw-base-"));
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          providers: {
            nextclaw: {
              apiBase: "https://api.nextclaw.io/v1",
              apiKey: "nc_free_test"
            }
          }
        },
        null,
        2
      )
    );

    const config = loadConfig(configPath);
    expect(config.providers.nextclaw.apiBase).toBe("https://ai-gateway-api.nextclaw.io/v1");
  });
});
