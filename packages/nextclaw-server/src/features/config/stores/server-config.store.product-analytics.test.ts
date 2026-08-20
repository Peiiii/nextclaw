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

  it("persists explicit consent and audience without changing defaults", () => {
    tempDir = mkdtempSync(join(tmpdir(), "nextclaw-product-analytics-config-"));
    const configPath = join(tempDir, "config.json");
    saveConfig(ConfigSchema.parse({}), configPath);

    expect(buildConfigView(loadConfig(configPath)).productAnalytics).toEqual({
      enabled: false,
      audience: "external",
    });
    expect(updateProductAnalytics(configPath, {
      enabled: true,
      audience: "qa",
    })).toEqual({ enabled: true, audience: "qa" });
    expect(loadConfig(configPath).productAnalytics).toEqual({
      enabled: true,
      audience: "qa",
    });
  });
});
