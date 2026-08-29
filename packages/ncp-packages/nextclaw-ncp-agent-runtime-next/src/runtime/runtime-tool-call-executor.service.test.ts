import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import {
  RuntimeToolCallExecutor,
  RuntimeToolCallBudget,
} from "./runtime-tool-call-executor.service.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function resultEvent(toolCallId: string): NcpEndpointEvent {
  return {
    type: NcpEventType.MessageToolCallResult,
    payload: {
      sessionId: "session-1",
      toolCallId,
      content: { ok: true },
    },
  };
}

function runErrorEvent(error: unknown): NcpEndpointEvent {
  return {
    type: NcpEventType.RunError,
    payload: {
      sessionId: "session-1",
      error: error instanceof Error ? error.message : String(error),
    },
  };
}

class ToolExecutorHarness {
  readonly active = new Set<string>();
  readonly controls = new Map<string, ReturnType<typeof deferred>>();
  readonly executor: RuntimeToolCallExecutor;
  readonly started: string[] = [];
  maxActive = 0;

  constructor(parallelToolNames: readonly string[], toolCallLimit = 1000) {
    const parallel = new Set(parallelToolNames);
    this.executor = new RuntimeToolCallExecutor({
      executeToolCall: async (toolCall) => {
        const control = deferred();
        this.controls.set(toolCall.toolCallId, control);
        this.started.push(toolCall.toolCallId);
        this.active.add(toolCall.toolCallId);
        this.maxActive = Math.max(this.maxActive, this.active.size);
        try {
          await control.promise;
        } finally {
          this.active.delete(toolCall.toolCallId);
        }
        return resultEvent(toolCall.toolCallId);
      },
      supportsParallelToolCalls: (toolCall) => parallel.has(toolCall.toolName),
      toRunErrorEvent: runErrorEvent,
      toolCallBudget: new RuntimeToolCallBudget(toolCallLimit),
    });
  }

  enqueue = (toolCallId: string, toolName: string): void => {
    this.executor.acceptEvent({
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        messageId: "message-1",
        toolCallId,
        toolName,
      },
    });
    this.executor.acceptEvent({
      type: NcpEventType.MessageToolCallEnd,
      payload: { sessionId: "session-1", toolCallId },
    });
  };

  release = (toolCallId: string): void => {
    const control = this.controls.get(toolCallId);
    if (!control) throw new Error(`Tool call ${toolCallId} has not started.`);
    control.resolve();
  };

  applyNextResult = async (): Promise<string> => {
    const item = await this.executor.nextEvent();
    item.resolveApplied();
    return item.event.type === NcpEventType.MessageToolCallResult
      ? item.event.payload.toolCallId
      : item.event.type;
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for tool scheduler state.");
}

describe("RuntimeToolCallExecutor scheduling", () => {
  it("runs opted-in tool calls concurrently and publishes results by completion time", async () => {
    const harness = new ToolExecutorHarness(["lookup"]);

    harness.enqueue("call-1", "lookup");
    harness.enqueue("call-2", "lookup");

    expect(harness.started).toEqual(["call-1", "call-2"]);
    expect(harness.maxActive).toBe(2);

    harness.release("call-2");
    expect(await harness.applyNextResult()).toBe("call-2");
    harness.release("call-1");
    expect(await harness.applyNextResult()).toBe("call-1");
    await waitFor(() => !harness.executor.hasPendingEvents());
  });

  it("keeps tools exclusive unless they explicitly opt in", async () => {
    const harness = new ToolExecutorHarness([]);

    harness.enqueue("call-1", "write");
    harness.enqueue("call-2", "write");

    expect(harness.started).toEqual(["call-1"]);
    harness.release("call-1");
    expect(await harness.applyNextResult()).toBe("call-1");
    await waitFor(() => harness.started.length === 2);
    expect(harness.started).toEqual(["call-1", "call-2"]);

    harness.release("call-2");
    expect(await harness.applyNextResult()).toBe("call-2");
    await waitFor(() => !harness.executor.hasPendingEvents());
  });

  it("treats an exclusive call as a FIFO barrier", async () => {
    const harness = new ToolExecutorHarness(["read"]);

    harness.enqueue("call-1", "read");
    harness.enqueue("call-2", "write");
    harness.enqueue("call-3", "read");

    expect(harness.started).toEqual(["call-1"]);
    harness.release("call-1");
    expect(await harness.applyNextResult()).toBe("call-1");
    await waitFor(() => harness.started.length === 2);
    expect(harness.started).toEqual(["call-1", "call-2"]);

    harness.release("call-2");
    expect(await harness.applyNextResult()).toBe("call-2");
    await waitFor(() => harness.started.length === 3);
    expect(harness.started).toEqual(["call-1", "call-2", "call-3"]);

    harness.release("call-3");
    expect(await harness.applyNextResult()).toBe("call-3");
    await waitFor(() => !harness.executor.hasPendingEvents());
  });

  it("limits parallel execution to eight calls", async () => {
    const harness = new ToolExecutorHarness(["read"]);

    for (let index = 1; index <= 10; index += 1) {
      harness.enqueue(`call-${index}`, "read");
    }

    expect(harness.started).toHaveLength(8);
    expect(harness.maxActive).toBe(8);

    for (let index = 1; index <= 10; index += 1) {
      await waitFor(() => harness.controls.has(`call-${index}`));
      harness.release(`call-${index}`);
      expect(await harness.applyNextResult()).toBe(`call-${index}`);
    }
    await waitFor(() => !harness.executor.hasPendingEvents());
    expect(harness.maxActive).toBe(8);
  });

  it("drops queued calls after cancellation", async () => {
    const harness = new ToolExecutorHarness([]);

    harness.enqueue("call-1", "write");
    harness.enqueue("call-2", "write");
    harness.executor.cancel(new Error("cancelled"));
    harness.release("call-1");

    await waitFor(() => harness.active.size === 0);
    expect(harness.started).toEqual(["call-1"]);
  });

  it("never starts a parallel tool call beyond the run budget", async () => {
    const harness = new ToolExecutorHarness(["read"], 2);

    harness.enqueue("call-1", "read");
    harness.enqueue("call-2", "read");
    expect(() => harness.enqueue("call-3", "read")).toThrow(
        "Tool call limit reached: fixed maximum 2; 2 tool calls already started.",
    );

    expect(harness.started).toEqual(["call-1", "call-2"]);
    harness.release("call-1");
    harness.release("call-2");
    await waitFor(() => harness.active.size === 0);
  });
});
