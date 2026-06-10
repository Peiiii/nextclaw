import { describe, expect, it } from "vitest";
import { CodexSdkNcpAgentRuntime } from "@/index.js";

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
      },
    ]);
  });
});
