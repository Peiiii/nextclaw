import type { SessionStore } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeCodeSdkNcpAgentRuntime } from "@claude-code-sdk/index.js";
import { describe, expect, it } from "vitest";

const sessionStore: SessionStore = {
  append: async () => undefined,
  load: async () => null,
};

function createRuntime(params?: {
  sessionRuntimeId?: string;
  setSessionMetadata?: (metadata: Record<string, unknown>) => void | Promise<void>;
}): ClaudeCodeSdkNcpAgentRuntime {
  return new ClaudeCodeSdkNcpAgentRuntime({
    sessionId: "nextclaw-session-1",
    apiKey: "test-key",
    sessionStore,
    sessionRuntimeId: params?.sessionRuntimeId,
    setSessionMetadata: params?.setSessionMetadata,
  });
}

function bindSessionRuntimeId(
  runtime: ClaudeCodeSdkNcpAgentRuntime,
  sessionRuntimeId: string,
): Promise<void> {
  return (runtime as unknown as {
    bindSessionRuntimeId: (nextSessionId: string) => Promise<void>;
  }).bindSessionRuntimeId(sessionRuntimeId);
}

describe("ClaudeCodeSdkNcpAgentRuntime session identity", () => {
  it("persists the first external session id", async () => {
    const writes: Record<string, unknown>[] = [];
    const runtime = createRuntime({
      setSessionMetadata: async (metadata) => {
        writes.push(metadata);
      },
    });

    await bindSessionRuntimeId(runtime, "claude-session-1");

    expect(writes).toEqual([
      {
        session_type: "claude",
        claude_session_id: "claude-session-1",
      },
    ]);
  });

  it("rejects a different external session id after identity is bound", async () => {
    const writes: Record<string, unknown>[] = [];
    const runtime = createRuntime({
      sessionRuntimeId: "claude-session-stable",
      setSessionMetadata: async (metadata) => {
        writes.push(metadata);
      },
    });

    await expect(
      bindSessionRuntimeId(runtime, "claude-session-replacement"),
    ).rejects.toThrow(
      'Claude session identity cannot change from "claude-session-stable" to "claude-session-replacement".',
    );
    expect(writes).toEqual([]);
  });
});
