import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigSchema, loadConfig, saveConfig } from "@nextclaw/core";
import { buildConfigView, updateProvider, updateRuntime } from "./server-config.store.js";

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

  it("initializes builtin provider models in config when the provider is first configured", () => {
    tempDir = mkdtempSync(join(tmpdir(), "nextclaw-provider-default-models-"));
    const configPath = join(tempDir, "config.json");
    saveConfig(ConfigSchema.parse({}), configPath);

    const view = updateProvider(configPath, "openrouter", {
      enabled: true,
      apiKey: "sk-or-test"
    });

    expect(view?.models).toContain("openrouter/deepseek/deepseek-v3.2");
    expect(loadConfig(configPath).providers.openrouter.models).toContain("openrouter/deepseek/deepseek-v3.2");
  });

  it("preserves narp stdio runtime model selection fields", () => {
    tempDir = mkdtempSync(join(tmpdir(), "nextclaw-runtime-model-selection-"));
    const configPath = join(tempDir, "config.json");
    saveConfig(ConfigSchema.parse({}), configPath);

    updateRuntime(configPath, {
      agents: {
        runtimes: {
          entries: {
            codex: {
              enabled: true,
              label: "Codex",
              type: "narp-stdio",
              config: {
                command: "nextclaw-codex-narp",
                wireDialect: "acp",
                modelSelectionMode: "optional",
                model: "openai/gpt-5",
                recommendedModel: "openai/gpt-5",
                supportedModels: ["openai/gpt-5", "dashscope/qwen3-coder-next"],
              },
            },
          },
        },
      },
    });

    expect(loadConfig(configPath).agents.runtimes.entries.codex?.config).toMatchObject({
      command: "nextclaw-codex-narp",
      modelSelectionMode: "optional",
      model: "openai/gpt-5",
      recommendedModel: "openai/gpt-5",
      supportedModels: ["openai/gpt-5", "dashscope/qwen3-coder-next"],
    });
  });
});
