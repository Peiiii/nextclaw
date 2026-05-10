import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, DEFAULT_WORKSPACE_PATH, loadConfig, saveConfig } from "@nextclaw/core";
import { EventBus } from "@nextclaw/kernel";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-model-config-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("model config route", () => {
  it("persists workspace updates and normalizes blank values", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const appEventBus = new EventBus();
    const emitAppEvent = vi.spyOn(appEventBus, "emit");

    const app = createUiRouter({
      configPath,
      appEventBus
    });

    const updateResponse = await app.request("http://localhost/api/config/model", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        workspace: "  ~/projects/nextclaw-workspace  "
      })
    });

    expect(updateResponse.status).toBe(200);
    const updatePayload = await updateResponse.json() as {
      ok: true;
      data: {
        model: string;
        workspace?: string;
      };
    };
    expect(updatePayload.ok).toBe(true);
    expect(updatePayload.data.model).toBe("openai/gpt-5.2");
    expect(updatePayload.data.workspace).toBe("~/projects/nextclaw-workspace");
    expect(loadConfig(configPath).agents.defaults.workspace).toBe("~/projects/nextclaw-workspace");
    expect(emitAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "config.updated" }),
      { path: "agents.defaults.model" },
      expect.any(Object)
    );
    expect(emitAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "config.updated" }),
      { path: "agents.defaults.workspace" },
      expect.any(Object)
    );

    const resetResponse = await app.request("http://localhost/api/config/model", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        workspace: "   "
      })
    });

    expect(resetResponse.status).toBe(200);
    expect(loadConfig(configPath).agents.defaults.workspace).toBe(DEFAULT_WORKSPACE_PATH);
  });
});
