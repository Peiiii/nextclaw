import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpencodeRuntimeConfigService } from "./opencode-runtime-config.service.js";

describe("OpencodeRuntimeConfigService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates an isolated OpenCode config from a NextClaw provider route", async () => {
    const runtimeRoot = mkdtempSync(join(tmpdir(), "nextclaw-opencode-narp-test-"));
    vi.stubEnv("NEXTCLAW_OPENCODE_NARP_HOME", runtimeRoot);
    const service = new OpencodeRuntimeConfigService();

    const config = await service.resolve({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "MiniMax-M2.7",
      promptMeta: {
        providerRoute: {
          model: "MiniMax-M2.7",
          apiKey: "secret-route-key",
          apiBase: "https://api.minimaxi.com/v1",
          headers: {
            "x-nextclaw-narp-api-mode": "chat_completions",
            "x-route": "1",
          },
        },
        sessionMetadata: {
          preferred_model: "minimax/MiniMax-M2.7",
        },
      },
    });

    expect(config).toMatchObject({
      args: ["acp", "--pure", "--cwd", "/tmp/workspace"],
      command: "opencode",
      cwd: "/tmp/workspace",
      providerRoute: {
        model: "minimax/MiniMax-M2.7",
        apiBase: "https://api.minimaxi.com/v1",
        headers: {
          "x-route": "1",
          "x-nextclaw-narp-api-mode": "chat_completions",
        },
      },
      sessionId: "session-1",
    });
    expect(config.env.HOME).toBe(join(runtimeRoot, "session-1", "home"));
    expect(config.env.OPENCODE_CONFIG).toBe(join(runtimeRoot, "session-1", "opencode.json"));
    expect(config.env.NEXTCLAW_OPENCODE_API_KEY).toBe("secret-route-key");
    expect(config.env.NEXTCLAW_OPENCODE_HEADER_0).toBe("1");

    const rawConfig = await readFile(config.env.OPENCODE_CONFIG, "utf8");
    expect(rawConfig).not.toContain("secret-route-key");
    expect(rawConfig).not.toContain('"x-nextclaw-narp-api-mode"');
    expect(JSON.parse(rawConfig)).toEqual({
      $schema: "https://opencode.ai/config.json",
      autoupdate: false,
      enabled_providers: ["minimax"],
      model: "minimax/MiniMax-M2.7",
      small_model: "minimax/MiniMax-M2.7",
      provider: {
        minimax: {
          npm: "@ai-sdk/openai-compatible",
          api: "chat",
          name: "NextClaw minimax",
          options: {
            baseURL: "https://api.minimaxi.com/v1",
            apiKey: "{env:NEXTCLAW_OPENCODE_API_KEY}",
            disableMaxOutputTokens: true,
            headers: {
              "x-route": "{env:NEXTCLAW_OPENCODE_HEADER_0}",
            },
          },
          models: {
            "MiniMax-M2.7": {
              name: "MiniMax-M2.7",
            },
          },
        },
      },
    });
  });

  it("falls back to an inferred provider id when metadata has only a local model id", async () => {
    const runtimeRoot = mkdtempSync(join(tmpdir(), "nextclaw-opencode-narp-test-"));
    vi.stubEnv("NEXTCLAW_OPENCODE_NARP_HOME", runtimeRoot);
    const service = new OpencodeRuntimeConfigService();

    const config = await service.resolve({
      sessionId: "session-2",
      cwd: "/tmp/workspace",
      modelId: "deepseek-v4-flash",
      promptMeta: {
        providerRoute: {
          model: "deepseek-v4-flash",
          apiKey: "deepseek-key",
          apiBase: "https://api.deepseek.com/v1",
          headers: {},
        },
      },
    });

    expect(config.providerRoute.model).toBe("deepseek/deepseek-v4-flash");
    const rawConfig = JSON.parse(await readFile(config.env.OPENCODE_CONFIG, "utf8"));
    expect(rawConfig.model).toBe("deepseek/deepseek-v4-flash");
    expect(rawConfig.provider.deepseek.models).toHaveProperty("deepseek-v4-flash");
  });
});
