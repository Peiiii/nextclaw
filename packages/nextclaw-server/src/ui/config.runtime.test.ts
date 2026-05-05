import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigSchema, loadConfig, saveConfig } from "@nextclaw/core";
import { buildConfigView, updateRuntime } from "./config.js";

describe("runtime config companion updates", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("persists companion enabled state through runtime config updates", () => {
    tempDir = mkdtempSync(join(tmpdir(), "nextclaw-companion-runtime-config-"));
    const configPath = join(tempDir, "config.json");
    saveConfig(ConfigSchema.parse({}), configPath);

    const result = updateRuntime(configPath, {
      companion: {
        enabled: true
      }
    });

    expect(result.companion?.enabled).toBe(true);

    const view = buildConfigView(loadConfig(configPath));
    expect(view.companion?.enabled).toBe(true);
  });
});
