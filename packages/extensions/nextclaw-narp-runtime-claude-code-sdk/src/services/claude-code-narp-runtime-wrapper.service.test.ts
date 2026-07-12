import { afterEach, describe, expect, it, vi } from "vitest";
import type { NcpAgentRunInput, NcpAgentRuntime } from "@nextclaw/ncp";
import type { ClaudeCodeSdkNcpAgentRuntimeConfig } from "@nextclaw/nextclaw-ncp-runtime-claude-code-sdk";
import { ClaudeCodeNarpRuntimeWrapper } from "./claude-code-narp-runtime-wrapper.service.js";

class FakeRuntime implements NcpAgentRuntime {
  run = async function* (_input: NcpAgentRunInput): AsyncGenerator<never> {};
}

describe("ClaudeCodeNarpRuntimeWrapper", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds Claude Code SDK runtime config from NARP stdio context", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
    vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "");

    const capturedConfigs: unknown[] = [];
    const wrapper = new ClaudeCodeNarpRuntimeWrapper((config) => {
      capturedConfigs.push(config);
      return new FakeRuntime();
    });

    const runtime = wrapper.createClaudeCodeRuntime({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "client-model",
      promptMeta: {
        providerRoute: {
          model: "claude-3-5-sonnet",
          apiKey: "route-key",
          apiBase: "https://route.example",
          headers: { "x-route": "1" },
        },
        sessionMetadata: {
          claude_session_id: "claude-session-1",
          project_root: "/tmp/workspace",
        },
      },
    });

    expect(runtime).toBeInstanceOf(FakeRuntime);
    expect(capturedConfigs).toEqual([
      {
        sessionId: "session-1",
        apiKey: "route-key",
        authToken: undefined,
        apiBase: "https://route.example",
        model: "claude-3-5-sonnet",
        workingDirectory: "/tmp/workspace",
        sessionRuntimeId: "claude-session-1",
        sessionMetadata: {
          claude_session_id: "claude-session-1",
          project_root: "/tmp/workspace",
        },
        baseQueryOptions: {
          permissionMode: "bypassPermissions",
          includePartialMessages: true,
        },
      },
    ]);
  });

  it("maps MiniMax provider routes to the Anthropic-compatible Claude endpoint", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
    vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "");

    const capturedConfigs: unknown[] = [];
    const wrapper = new ClaudeCodeNarpRuntimeWrapper((config) => {
      capturedConfigs.push(config);
      return new FakeRuntime();
    });

    wrapper.createClaudeCodeRuntime({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "client-model",
      promptMeta: {
        providerRoute: {
          model: "MiniMax-M2.7",
          apiKey: "minimax-key",
          apiBase: "https://api.minimaxi.com/v1",
          headers: {},
        },
        sessionMetadata: {},
      },
    });

    expect(capturedConfigs).toMatchObject([
      {
        apiKey: "minimax-key",
        authToken: "minimax-key",
        apiBase: "https://api.minimaxi.com/anthropic",
        model: "MiniMax-M2.7",
      },
    ]);
  });

  it("routes ChatCompletions provider routes through the Anthropic gateway bridge", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "anthropic-token");
    vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "");

    const capturedConfigs: unknown[] = [];
    const wrapper = new ClaudeCodeNarpRuntimeWrapper((config) => {
      capturedConfigs.push(config);
      return new FakeRuntime();
    });

    wrapper.createClaudeCodeRuntime({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "deepseek/deepseek-v4-flash",
      promptMeta: {
        providerRoute: {
          model: "deepseek-v4-flash",
          apiKey: "deepseek-key",
          apiBase: "https://api.deepseek.com",
          headers: { "x-nextclaw-narp-api-mode": "chat_completions" },
        },
        sessionMetadata: {},
      },
    });

    expect(capturedConfigs).toMatchObject([
      {
        apiKey: "deepseek-key",
        authToken: "anthropic-token",
        apiBase: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
        anthropicGateway: {
          upstreamApiBase: "https://api.deepseek.com",
          upstreamApiKey: "deepseek-key",
        },
      },
    ]);
  });

  it("keeps MiniMax ChatCompletions routes on the original OpenAI-compatible base for the gateway", () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
    vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "");

    const capturedConfigs: unknown[] = [];
    const wrapper = new ClaudeCodeNarpRuntimeWrapper((config) => {
      capturedConfigs.push(config);
      return new FakeRuntime();
    });

    wrapper.createClaudeCodeRuntime({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "minimax/MiniMax-M2.7",
      promptMeta: {
        providerRoute: {
          model: "MiniMax-M2.7",
          apiKey: "minimax-key",
          apiBase: "https://api.minimaxi.com/v1",
          headers: { "x-nextclaw-narp-api-mode": "chat_completions" },
        },
        sessionMetadata: {},
      },
    });

    expect(capturedConfigs).toMatchObject([
      {
        apiKey: "minimax-key",
        authToken: "minimax-key",
        apiBase: "https://api.minimaxi.com/v1",
        model: "MiniMax-M2.7",
        anthropicGateway: {
          upstreamApiBase: "https://api.minimaxi.com/v1",
          upstreamApiKey: "minimax-key",
        },
      },
    ]);
  });

  it("does not invent a Claude Code working directory from process cwd", () => {
    const capturedConfigs: Array<{ workingDirectory?: string }> = [];
    const wrapper = new ClaudeCodeNarpRuntimeWrapper((config) => {
      capturedConfigs.push(config);
      return new FakeRuntime();
    });

    wrapper.createClaudeCodeRuntime({
      sessionId: "session-1",
      promptMeta: {
        sessionMetadata: {},
      },
    });

    expect(capturedConfigs[0]?.workingDirectory).toBeUndefined();
  });

  it("delegates model and configuration ownership to Claude Code for runtime-default requests", () => {
    vi.stubEnv("NEXTCLAW_API_KEY", "nextclaw-key");
    vi.stubEnv("NEXTCLAW_API_BASE", "https://nextclaw.example");
    vi.stubEnv("NEXTCLAW_MODEL", "nextclaw-model");

    const capturedConfigs: ClaudeCodeSdkNcpAgentRuntimeConfig[] = [];
    const wrapper = new ClaudeCodeNarpRuntimeWrapper((config) => {
      capturedConfigs.push(config);
      return new FakeRuntime();
    });

    wrapper.createClaudeCodeRuntime({
      sessionId: "session-runtime-default",
      cwd: "/tmp/workspace",
      promptMeta: {
        sessionMetadata: {},
      },
    });

    expect(capturedConfigs).toMatchObject([
      {
        sessionId: "session-runtime-default",
        apiKey: "",
        useClaudeRuntimeDefaults: true,
        authToken: undefined,
        apiBase: undefined,
        model: undefined,
        workingDirectory: "/tmp/workspace",
        baseQueryOptions: {
          settingSources: ["user", "project", "local"],
        },
      },
    ]);
  });
});
