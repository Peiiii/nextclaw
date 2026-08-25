import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigSchema, loadConfig, saveConfig } from "@nextclaw/core";
import {
  buildConfigView,
  updateProductAnalytics,
} from "./server-config.store.js";

describe("product analytics config updates", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("persists anonymous reporting opt-out and audience without changing v2", () => {
    tempDir = mkdtempSync(join(tmpdir(), "nextclaw-product-analytics-config-"));
    const configPath = join(tempDir, "config.json");
    saveConfig(ConfigSchema.parse({}), configPath);

    expect(buildConfigView(loadConfig(configPath)).productAnalytics).toEqual({
      schemaVersion: 2,
      enabled: true,
      audience: "external",
    });
    expect(updateProductAnalytics(configPath, {
      enabled: false,
      audience: "qa",
    })).toEqual({ schemaVersion: 2, enabled: false, audience: "qa" });
    expect(loadConfig(configPath).productAnalytics).toEqual({
      schemaVersion: 2,
      enabled: false,
      audience: "qa",
    });
  });
});
