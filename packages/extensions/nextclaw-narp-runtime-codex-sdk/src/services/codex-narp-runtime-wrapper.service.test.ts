import { afterEach, describe, expect, it, vi } from "vitest";
import type { NcpAgentRunInput, NcpAgentRuntime } from "@nextclaw/ncp";
import type { CodexDesktopVisibilityPatch } from "./codex-desktop-visibility-patch.service.js";
import {
  CodexNarpRuntimeWrapper,
  type CodexResponsesBridgeFactory,
} from "./codex-narp-runtime-wrapper.service.js";

class FakeRuntime implements NcpAgentRuntime {
  async *run(_input: NcpAgentRunInput): AsyncGenerator<never> {}
}

const noopDesktopVisibilityPatch: CodexDesktopVisibilityPatch = {
  ensureWorkspaceVisible: async () => undefined,
};

function createWrapper(
  ensureResponsesBridge?: CodexResponsesBridgeFactory,
): CodexNarpRuntimeWrapper {
  return new CodexNarpRuntimeWrapper(
    () => new FakeRuntime(),
    ensureResponsesBridge ?? failUnexpectedResponsesBridge,
    noopDesktopVisibilityPatch,
  );
}

const failUnexpectedResponsesBridge: CodexResponsesBridgeFactory = async () => {
  throw new Error("Responses bridge should not be created in this test.");
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CodexNarpRuntimeWrapper", () => {
  it("patches Codex Desktop visibility for the final working directory", async () => {
    const workingDirectories: Array<string | undefined> = [];
    const desktopVisibilityPatch: CodexDesktopVisibilityPatch = {
      ensureWorkspaceVisible: async ({ workingDirectory }) => {
        workingDirectories.push(workingDirectory);
      },
    };
    const wrapper = new CodexNarpRuntimeWrapper(
      () => new FakeRuntime(),
      async () => ({ baseUrl: "http://127.0.0.1:43210" }),
      desktopVisibilityPatch,
    );

    await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      promptMeta: {
        sessionMetadata: {},
      },
    });

    expect(workingDirectories).toEqual(["/tmp/workspace"]);
  });

  it("builds Codex SDK runtime config from NARP stdio context", async () => {
    const wrapper = createWrapper();

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
          codex_thread_model: "provider/model-a",
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
        codex_thread_model: "provider/model-a",
        project_root: "/tmp/workspace",
        preferred_thinking: "medium",
      },
      cliConfig: {
        model_provider: "provider",
        preferred_auth_method: "apikey",
        show_raw_agent_reasoning: true,
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

  it("does not override the Codex default model when no route or session model is provided", async () => {
    const wrapper = createWrapper();

    const config = await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      promptMeta: {
        sessionMetadata: {},
      },
    });

    expect(config.model).toBeUndefined();
    expect(config.threadOptions?.model).toBeUndefined();
    expect(config.threadOptions).toMatchObject({
      workingDirectory: "/tmp/workspace",
      skipGitRepoCheck: true,
    });
  });

  it("does not invent a Codex working directory from process cwd", async () => {
    const wrapper = createWrapper();

    const config = await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      promptMeta: {
        sessionMetadata: {},
      },
    });

    expect(config.threadOptions?.workingDirectory).toBeUndefined();
  });

  it("does not resume an unscoped Codex thread when using the runtime default model", async () => {
    const wrapper = createWrapper();

    const config = await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      promptMeta: {
        sessionMetadata: {
          codex_thread_id: "thread-created-by-an-old-model",
          model: "__nextclaw_runtime_default__",
          preferred_model: "__nextclaw_runtime_default__",
        },
      },
    });

    expect(config.threadId).toBeNull();
    expect(config.model).toBeUndefined();
    expect(config.threadOptions?.model).toBeUndefined();
  });

  it("does not resume a Codex thread when its model scope differs from the current model", async () => {
    const wrapper = createWrapper();

    const config = await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "__nextclaw_runtime_default__",
      promptMeta: {
        sessionMetadata: {
          codex_thread_id: "thread-created-by-deepseek",
          codex_thread_model: "nextclaw-codex-bridge-chat/deepseek-v4-flash",
          model: "__nextclaw_runtime_default__",
          preferred_model: "__nextclaw_runtime_default__",
        },
      },
    });

    expect(config.threadId).toBeNull();
    expect(config.model).toBeUndefined();
    expect(config.threadOptions?.model).toBeUndefined();
  });

  it("enables raw Codex reasoning output for runtime-default thinking without overriding the model", async () => {
    vi.stubEnv("NEXTCLAW_MODEL", "deepseek-v4-flash");
    vi.stubEnv("NEXTCLAW_API_BASE", "https://api.deepseek.com");
    vi.stubEnv("NEXTCLAW_API_KEY", "deepseek-key");
    const wrapper = createWrapper();

    const config = await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      promptMeta: {
        sessionMetadata: {
          preferred_thinking: "high",
          model: "__nextclaw_runtime_default__",
        },
      },
    });

    expect(config.model).toBeUndefined();
    expect(config.apiBase).toBeUndefined();
    expect(config.apiKey).toBe("");
    expect(config.threadOptions?.model).toBeUndefined();
    expect(config.threadOptions?.modelReasoningEffort).toBe("high");
    expect(config.cliConfig).toEqual({
      show_raw_agent_reasoning: true,
    });
  });
});

describe("CodexNarpRuntimeWrapper runtime wiring", () => {
  it("passes the NARP session metadata writer into the Codex SDK runtime config", async () => {
    const wrapper = createWrapper();
    const setSessionMetadata = () => undefined;

    const config = await wrapper.buildRuntimeConfig({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      promptMeta: {
        sessionMetadata: {},
      },
      setSessionMetadata,
    });

    expect(config.setSessionMetadata).toBe(setSessionMetadata);
  });

  it("uses the Codex Responses bridge for MiniMax chat-compatible routes", async () => {
    const wrapper = createWrapper(
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
    const wrapper = createWrapper(
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
