import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigSchema } from "./config-schema.config.js";
import { loadConfig } from "../utils/config-loader.utils.js";

describe("product analytics config", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("enables anonymous v2 reporting by default and accepts audience segregation", () => {
    expect(ConfigSchema.parse({}).productAnalytics).toEqual({
      schemaVersion: 2,
      enabled: true,
      audience: "external",
    });
    expect(ConfigSchema.parse({
      productAnalytics: { schemaVersion: 2, enabled: false, audience: "qa" },
    }).productAnalytics).toEqual({ schemaVersion: 2, enabled: false, audience: "qa" });
  });

  it("migrates the legacy pseudonymous setting once and preserves later opt-out", () => {
    const directory = mkdtempSync(join(tmpdir(), "nextclaw-product-analytics-v2-"));
    directories.push(directory);
    const configPath = join(directory, "config.json");
    writeFileSync(configPath, JSON.stringify({
      productAnalytics: { enabled: false, audience: "qa" },
    }));

    expect(loadConfig(configPath).productAnalytics).toEqual({
      schemaVersion: 2,
      enabled: true,
      audience: "qa",
    });
    const migrated = JSON.parse(readFileSync(configPath, "utf8"));
    migrated.productAnalytics.enabled = false;
    writeFileSync(configPath, JSON.stringify(migrated));

    expect(loadConfig(configPath).productAnalytics).toEqual({
      schemaVersion: 2,
      enabled: false,
      audience: "qa",
    });
  });
});
