import { describe, expect, it } from "vitest";
import { CodexSdkNcpAgentRuntime } from "@/index.js";
import { CodexAppServerNcpAgentRuntime } from "./codex-app-server-ncp-agent-runtime.service.js";

describe("CodexSdkNcpAgentRuntime thread metadata", () => {
  it("awaits the session metadata writer before continuing after thread.started", async () => {
    const writes: Record<string, unknown>[] = [];
    let writerCompleted = false;
    const runtime = new CodexSdkNcpAgentRuntime({
      sessionId: "session-1",
      apiKey: "sk-test",
      setSessionMetadata: async (metadata) => {
        await Promise.resolve();
        writes.push(metadata);
        writerCompleted = true;
      },
    });

    const result = await (runtime as unknown as {
      handleThreadEvent: (params: unknown) => AsyncGenerator<unknown, boolean>;
    }).handleThreadEvent({
      sessionId: "session-1",
      messageId: "message-1",
      runId: "run-1",
      event: {
        type: "thread.started",
        thread_id: "thread-1",
      },
      itemTextById: new Map(),
      toolStateById: new Map(),
    }).next();

    expect(result).toEqual({ done: true, value: false });
    expect(writerCompleted).toBe(true);
    expect(writes).toEqual([
      {
        session_type: "codex",
        codex_thread_id: "thread-1",
        codex_thread_model: "__nextclaw_runtime_default__",
      },
    ]);
  });
});

describe("CodexAppServerNcpAgentRuntime thread metadata", () => {
  it("stores the model scope together with a started Codex thread id", async () => {
    const writes: Record<string, unknown>[] = [];
    const runtime = new CodexAppServerNcpAgentRuntime({
      sessionId: "session-1",
      apiKey: "sk-test",
      model: "deepseek-v4-flash",
      threadOptions: {
        model: "nextclaw-codex-bridge-chat/deepseek-v4-flash",
      },
      setSessionMetadata: async (metadata) => {
        writes.push(metadata);
      },
    });

    const result = await (runtime as unknown as {
      handleNotification: (params: unknown) => AsyncGenerator<unknown, boolean>;
    }).handleNotification({
      sessionId: "session-1",
      messageId: "message-1",
      runId: "run-1",
      notification: {
        method: "thread/started",
        params: { thread: { id: "thread-1" } },
      },
      textState: new Set(),
      textDeltaState: new Set(),
      reasoningState: new Set(),
      reasoningDeltaState: new Set(),
      toolState: new Set(),
    }).next();

    expect(result).toEqual({ done: true, value: false });
    expect(writes).toEqual([
      {
        session_type: "codex",
        codex_thread_id: "thread-1",
        codex_thread_model: "nextclaw-codex-bridge-chat/deepseek-v4-flash",
      },
    ]);
  });

  it("runs the pluggable desktop thread index sync after turn completion", async () => {
    const syncedThreadIds: Array<string | null | undefined> = [];
    const runtime = new CodexAppServerNcpAgentRuntime({
      sessionId: "session-1",
      apiKey: "sk-test",
      threadId: "thread-1",
      desktopThreadIndexSync: {
        syncThread: async ({ threadId }) => {
          syncedThreadIds.push(threadId);
        },
      },
    });

    const generator = (runtime as unknown as {
      handleNotification: (params: unknown) => AsyncGenerator<unknown, boolean>;
    }).handleNotification({
      sessionId: "session-1",
      messageId: "message-1",
      runId: "run-1",
      notification: {
        method: "turn/completed",
        params: {},
      },
      textState: new Set(),
      textDeltaState: new Set(),
      reasoningState: new Set(),
      reasoningDeltaState: new Set(),
      toolState: new Set(),
    });

    let result = await generator.next();
    while (!result.done) {
      result = await generator.next();
    }

    expect(result.value).toBe(true);
    expect(syncedThreadIds).toEqual(["thread-1"]);
  });
});
