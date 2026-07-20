import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { describe, expect, it, vi } from "vitest";
import { CodexSdkNcpAgentRuntime } from "@/index.js";
import { CodexAppServerNcpAgentRuntime } from "./codex-app-server-ncp-agent-runtime.service.js";

async function waitForCondition(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Condition was not met.");
}

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

describe("CodexAppServerNcpAgentRuntime thread metadata", () => {
  it("compacts the resumed Codex thread through the app-server command", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "thread/resume") {
        return { thread: { id: "thread-1" } };
      }
      if (method === "thread/compact/start") {
        return {};
      }
      throw new Error(`Unexpected request: ${method}`);
    });
    const runtime = new CodexAppServerNcpAgentRuntime({
      sessionId: "session-1",
      apiKey: "sk-test",
      threadId: "thread-1",
      desktopThreadIndexSync: false,
    });
    (runtime as unknown as {
      resolveClient: () => Promise<{ request: typeof request }>;
    }).resolveClient = async () => ({ request });

    await runtime.compactContext({ sessionId: "session-1" });

    expect(request.mock.calls).toEqual([
      ["thread/resume", expect.objectContaining({ threadId: "thread-1" })],
      ["thread/compact/start", { threadId: "thread-1" }],
    ]);
  });

  it("stores a started Codex thread id without making the model part of session identity", async () => {
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

  it("emits message.abort without waiting for the next app-server notification", async () => {
    const controller = new AbortController();
    let closeNotificationStream = (next: IteratorResult<never>): void => {
      throw new Error(`Unexpected notification close: ${String(next.done)}`);
    };
    const request = vi.fn(async (method: string) => {
      if (method === "thread/resume") {
        return { thread: { id: "thread-1" } };
      }
      if (method === "turn/start") {
        return { turn: { id: "turn-1" } };
      }
      if (method === "turn/interrupt") {
        return {};
      }
      throw new Error(`Unexpected request: ${method}`);
    });
    const client = {
      request,
      nextNotification: vi.fn(
        () => new Promise<IteratorResult<never>>((resolve) => {
          closeNotificationStream = resolve;
        }),
      ),
      dispose: vi.fn(() => closeNotificationStream({ done: true, value: undefined })),
    };
    const runtime = new CodexAppServerNcpAgentRuntime({
      sessionId: "session-1",
      apiKey: "sk-test",
      threadId: "thread-1",
      desktopThreadIndexSync: false,
      inputBuilder: () => "hello",
    });
    (runtime as unknown as {
      resolveClient: () => Promise<typeof client>;
    }).resolveClient = async () => client;

    const iterator = runtime.run({
      sessionId: "session-1",
      correlationId: "corr-1",
      messages: [],
    }, { signal: controller.signal })[Symbol.asyncIterator]();

    expect((await iterator.next()).value).toMatchObject({
      type: NcpEventType.RunStarted,
      payload: { sessionId: "session-1" },
    });
    expect((await iterator.next()).value).toMatchObject({
      type: NcpEventType.RunMetadata,
      payload: { sessionId: "session-1" },
    });

    const pendingAbortEvent = iterator.next();
    await waitForCondition(() => request.mock.calls.some(([method]) => method === "turn/start"));
    await waitForCondition(() => client.nextNotification.mock.calls.length > 0);
    controller.abort("stop");

    const result = await pendingAbortEvent;
    expect(result.done).toBe(false);
    expect(result.value as NcpEndpointEvent).toMatchObject({
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: "session-1",
        correlationId: "corr-1",
      },
    });
    expect(request).toHaveBeenCalledWith(
      "turn/interrupt",
      { threadId: "thread-1", turnId: "turn-1" },
      5000,
    );
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
  });
});
