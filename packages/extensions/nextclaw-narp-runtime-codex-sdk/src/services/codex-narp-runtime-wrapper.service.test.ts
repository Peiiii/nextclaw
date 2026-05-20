import { describe, expect, it } from "vitest";
import type { NcpAgentRunInput, NcpAgentRuntime } from "@nextclaw/ncp";
import { CodexNarpRuntimeWrapper } from "./codex-narp-runtime-wrapper.service.js";

class FakeRuntime implements NcpAgentRuntime {
  async *run(_input: NcpAgentRunInput): AsyncGenerator<never> {}
}

describe("CodexNarpRuntimeWrapper", () => {
  it("builds Codex SDK runtime config from NARP stdio context", async () => {
    const wrapper = new CodexNarpRuntimeWrapper(() => new FakeRuntime());

    const config = await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "provider/model-a",
      promptMeta: {
        providerRoute: {
          model: "model-a",
          apiKey: "route-key",
          apiBase: "https://route.example/v1",
          headers: { "x-route": "1" },
        },
        sessionMetadata: {
          codex_thread_id: "thread-1",
          project_root: "/tmp/workspace",
          preferred_thinking: "medium",
        },
      },
    });

    expect(config).toEqual({
      sessionId: "session-1",
      apiKey: "route-key",
      apiBase: "https://route.example/v1",
      model: "model-a",
      threadId: "thread-1",
      sessionMetadata: {
        codex_thread_id: "thread-1",
        project_root: "/tmp/workspace",
        preferred_thinking: "medium",
      },
      cliConfig: {
        model_provider: "provider",
        preferred_auth_method: "apikey",
        model_providers: {
          provider: {
            name: "provider",
            base_url: "https://route.example/v1",
            wire_api: "responses",
            requires_openai_auth: true,
          },
        },
      },
      threadOptions: {
        model: "provider/model-a",
        workingDirectory: "/tmp/workspace",
        skipGitRepoCheck: true,
        modelReasoningEffort: "medium",
      },
    });
  });

  it("uses the Codex Responses bridge for MiniMax chat-compatible routes", async () => {
    const wrapper = new CodexNarpRuntimeWrapper(
      () => new FakeRuntime(),
      async (bridgeConfig) => {
        expect(bridgeConfig).toMatchObject({
          upstreamApiBase: "https://api.minimaxi.com/v1",
          upstreamApiKey: "minimax-key",
          upstreamExtraHeaders: { "x-route": "1" },
          defaultModel: "MiniMax-M2.7",
          upstreamReasoningSplit: true,
          modelPrefixes: ["minimax", "nextclaw-codex-bridge-minimax"],
        });
        return { baseUrl: "http://127.0.0.1:43210" };
      },
    );

    const config = await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "minimax/MiniMax-M2.7",
      promptMeta: {
        providerRoute: {
          model: "MiniMax-M2.7",
          apiKey: "minimax-key",
          apiBase: "https://api.minimaxi.com/v1",
          headers: { "x-route": "1" },
        },
        sessionMetadata: {},
      },
    });

    expect(config).toMatchObject({
      apiKey: "minimax-key",
      apiBase: "http://127.0.0.1:43210",
      model: "MiniMax-M2.7",
      cliConfig: {
        model_provider: "nextclaw-codex-bridge-minimax",
        model_providers: {
          "nextclaw-codex-bridge-minimax": {
            base_url: "http://127.0.0.1:43210",
            wire_api: "responses",
          },
        },
      },
      threadOptions: {
        model: "nextclaw-codex-bridge-minimax/MiniMax-M2.7",
      },
    });
  });

  it("uses the Codex Responses bridge for any chat-completions provider route", async () => {
    const wrapper = new CodexNarpRuntimeWrapper(
      () => new FakeRuntime(),
      async (bridgeConfig) => {
        expect(bridgeConfig).toMatchObject({
          upstreamApiBase: "https://api.deepseek.com",
          upstreamApiKey: "deepseek-key",
          upstreamExtraHeaders: { "x-route": "1" },
          defaultModel: "deepseek-v4-flash",
          upstreamReasoningSplit: false,
          modelPrefixes: ["deepseek", "nextclaw-codex-bridge-deepseek"],
        });
        return { baseUrl: "http://127.0.0.1:43211" };
      },
    );

    const config = await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "deepseek/deepseek-v4-flash",
      promptMeta: {
        providerRoute: {
          model: "deepseek-v4-flash",
          apiKey: "deepseek-key",
          apiBase: "https://api.deepseek.com",
          headers: {
            "x-nextclaw-narp-api-mode": "chat_completions",
            "x-route": "1",
          },
        },
        sessionMetadata: {},
      },
    });

    expect(config).toMatchObject({
      apiKey: "deepseek-key",
      apiBase: "http://127.0.0.1:43211",
      model: "deepseek-v4-flash",
      cliConfig: {
        model_provider: "nextclaw-codex-bridge-deepseek",
        model_providers: {
          "nextclaw-codex-bridge-deepseek": {
            base_url: "http://127.0.0.1:43211",
            wire_api: "responses",
          },
        },
      },
      threadOptions: {
        model: "nextclaw-codex-bridge-deepseek/deepseek-v4-flash",
      },
    });
  });
});
