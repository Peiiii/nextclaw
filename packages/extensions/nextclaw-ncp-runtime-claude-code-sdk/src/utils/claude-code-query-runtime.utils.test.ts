import { describe, expect, it } from "vitest";
import type { SessionStore } from "@anthropic-ai/claude-agent-sdk";
import {
  buildClaudeQueryOptions,
  shouldRetryClaudeQuery,
} from "./claude-code-query-runtime.utils.js";

describe("buildClaudeQueryOptions", () => {
  it("passes the stable session store and resume ID independently of the model", () => {
    const sessionStore: SessionStore = {
      append: async () => undefined,
      load: async () => null,
    };

    const options = buildClaudeQueryOptions({
      config: {
        sessionId: "nextclaw-session-1",
        apiKey: "provider-key",
        model: "MiniMax-M2.7",
        workingDirectory: "/tmp/nextclaw-workspace",
      },
      abortController: new AbortController(),
      preparedAccess: { apiKey: "provider-key" },
      sessionRuntimeId: "b98596b8-2b88-4a54-8f7b-c0ac5bb7d46c",
      sessionStore,
    });

    expect(options).toMatchObject({
      model: "MiniMax-M2.7",
      resume: "b98596b8-2b88-4a54-8f7b-c0ac5bb7d46c",
      sessionStore,
    });
  });
});

describe("shouldRetryClaudeQuery", () => {
  const syntheticFailure = {
    type: "assistant",
    error: "unknown",
    message: {
      model: "<synthetic>",
      content: [{ type: "text", text: "API Error: empty or malformed response" }],
    },
  };

  it("retries only transient pre-output failures before the final attempt", () => {
    expect(shouldRetryClaudeQuery(1, syntheticFailure, false)).toBe(true);
    expect(shouldRetryClaudeQuery(1, syntheticFailure, true)).toBe(false);
    expect(shouldRetryClaudeQuery(3, syntheticFailure, false)).toBe(false);
  });
});
