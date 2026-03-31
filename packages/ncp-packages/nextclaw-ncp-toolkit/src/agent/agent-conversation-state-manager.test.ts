import { describe, expect, it } from "vitest";
import { type NcpMessage, NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "./agent-conversation-state-manager.js";

const now = "2026-03-12T00:00:00.000Z";

const createMessage = (overrides: Partial<NcpMessage> = {}): NcpMessage => {
  return {
    id: "msg-1",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    parts: [],
    timestamp: now,
    ...overrides,
  };
};

describe("DefaultNcpAgentConversationStateManager streaming", () => {
  it("aggregates text streaming events and finalizes on run.finished", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        delta: "hello ",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        delta: "world",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextEnd,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
      },
    });

    const midSnapshot = manager.getSnapshot();
    expect(midSnapshot.streamingMessage?.status).toBe("pending");
    expect(midSnapshot.streamingMessage?.parts).toEqual([
      { type: "text", text: "hello world" },
    ]);

    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.streamingMessage).toBeNull();
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]?.id).toBe("assistant-1");
    expect(snapshot.messages[0]?.status).toBe("final");
  });

  it("clears activeRun on run.finished", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });
    expect(manager.getSnapshot().activeRun?.runId).toBe("run-1");

    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });

    expect(manager.getSnapshot().activeRun).toBeNull();
  });

  it("preserves unchanged message references across unrelated snapshot updates", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    await manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({ id: "assistant-stable" }),
      },
    });

    const firstSnapshot = manager.getSnapshot();

    await manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });

    const secondSnapshot = manager.getSnapshot();
    expect(secondSnapshot.messages).toBe(firstSnapshot.messages);
    expect(secondSnapshot.messages[0]).toBe(firstSnapshot.messages[0]);
  });

  it("strips reply tags from assistant text when the run is finalized", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-reply",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-reply",
        delta: "[[reply_to_current]] hello",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-reply",
      },
    });

    expect(manager.getSnapshot().messages.at(-1)).toMatchObject({
      id: "assistant-reply",
      sessionId: "session-1",
      role: "assistant",
      status: "final",
      parts: [{ type: "text", text: "hello" }],
      metadata: {
        reply_to: "assistant-reply",
      },
    });
  });

  it("handles reasoning and tool-call lifecycle on one streaming message", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageReasoningStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-2",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageReasoningDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-2",
        delta: "thinking ",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageReasoningDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-2",
        delta: "hard",
      },
    });

    manager.dispatch({
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-2",
        toolCallId: "tool-1",
        toolName: "search",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallArgsDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-2",
        toolCallId: "tool-1",
        delta: '{"q":"hel',
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallArgsDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-2",
        toolCallId: "tool-1",
        delta: 'lo"}',
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallEnd,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-1",
        content: { ok: true },
      },
    });

    const snapshot = manager.getSnapshot();
    const streaming = snapshot.streamingMessage;
    expect(streaming?.id).toBe("assistant-2");
    expect(streaming?.parts[0]).toEqual({
      type: "reasoning",
      text: "thinking hard",
    });
    expect(streaming?.parts[1]).toEqual({
      type: "tool-invocation",
      toolCallId: "tool-1",
      toolName: "search",
      state: "result",
      args: '{"q":"hello"}',
      result: { ok: true },
    });
  });
});

describe("DefaultNcpAgentConversationStateManager late run guards", () => {
  it("ignores a late run.started for a run that already finished", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });

    expect(manager.getSnapshot().activeRun).toBeNull();
  });

  it("ignores a late ready metadata event for a run that already finished", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
        metadata: {
          kind: "ready",
          runId: "run-1",
          sessionId: "session-1",
          supportsAbort: true,
        },
      },
    });

    expect(manager.getSnapshot().activeRun).toBeNull();
  });
});

describe("DefaultNcpAgentConversationStateManager reasoning boundaries", () => {
  it("keeps a new reasoning segment after tool invocation as a separate part", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageReasoningDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-4",
        delta: "first thinking",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-4",
        toolCallId: "tool-2",
        toolName: "search",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallArgs,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-2",
        args: '{"q":"weather"}',
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallEnd,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-2",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-2",
        content: { ok: true },
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageReasoningDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-4",
        delta: "second thinking",
      },
    });

    const streaming = manager.getSnapshot().streamingMessage;
    expect(streaming?.parts).toEqual([
      { type: "reasoning", text: "first thinking" },
      {
        type: "tool-invocation",
        toolCallId: "tool-2",
        toolName: "search",
        state: "result",
        args: '{"q":"weather"}',
        result: { ok: true },
      },
      { type: "reasoning", text: "second thinking" },
    ]);
  });

  it("preserves tool-first streaming parts when text later arrives with the real assistant message id", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-9",
        toolName: "command_execution",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallArgs,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-9",
        args: '{"command":"pwd"}',
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-9",
        content: {
          status: "completed",
        },
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-9",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-9",
        delta: "done",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-9",
      },
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.streamingMessage).toBeNull();
    expect(snapshot.messages.at(-1)).toEqual({
      id: "assistant-9",
      sessionId: "session-1",
      role: "assistant",
      status: "final",
      timestamp: expect.any(String),
      parts: [
        {
          type: "tool-invocation",
          toolCallId: "tool-9",
          toolName: "command_execution",
          state: "result",
          args: '{"command":"pwd"}',
          result: {
            status: "completed",
          },
        },
        {
          type: "text",
          text: "done",
        },
      ],
    });
  });
});

describe("DefaultNcpAgentConversationStateManager error and notify", () => {
  it("marks streaming message as error on run.error", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-3",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-3",
        delta: "partial",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunError,
      payload: {
        sessionId: "session-1",
        runId: "run-3",
        error: "failed",
      },
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.streamingMessage).toBeNull();
    expect(snapshot.error?.message).toBe("failed");
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]?.status).toBe("error");
  });

  it("keeps subscriber silent on non-handled request event", () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    let callbackCount = 0;

    manager.subscribe(() => {
      callbackCount += 1;
    });

    manager.dispatch({
      type: NcpEventType.MessageRequest,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "user-0",
          role: "user",
          status: "final",
          parts: [{ type: "text", text: "ping" }],
        }),
      },
    });

    expect(callbackCount).toBe(0);

    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "user-1",
          role: "user",
          status: "final",
          parts: [{ type: "text", text: "ping" }],
        }),
      },
    });

    expect(callbackCount).toBe(1);
  });

  it("does not expose abort as error and finalizes partial reply", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-5",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-5",
        delta: "partial",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-5",
      },
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.error).toBeNull();
    expect(snapshot.streamingMessage).toBeNull();
    expect(snapshot.messages.at(-1)).toMatchObject({
      id: "assistant-5",
      status: "final",
      parts: [{ type: "text", text: "partial" }],
    });
  });

  it("maps run.error to runtime-error and allows endpoint.error override", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.RunError,
      payload: {},
    });
    expect(manager.getSnapshot().error).toMatchObject({
      code: "runtime-error",
      message: "Agent run failed.",
    });

    manager.dispatch({
      type: NcpEventType.EndpointError,
      payload: {
        code: "auth-error",
        message: "missing token",
      },
    });
    expect(manager.getSnapshot().error).toMatchObject({
      code: "auth-error",
      message: "missing token",
    });
  });

  it("keeps the in-flight assistant message and clears active run on endpoint.error", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "user-1",
          role: "user",
          status: "final",
          parts: [{ type: "text", text: "ping" }],
        }),
      },
    });
    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        delta: "partial reply",
      },
    });

    manager.dispatch({
      type: NcpEventType.EndpointError,
      payload: {
        code: "runtime-error",
        message: "stream ended without final event",
      },
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.activeRun).toBeNull();
    expect(snapshot.streamingMessage).toBeNull();
    expect(snapshot.error).toMatchObject({
      code: "runtime-error",
      message: "stream ended without final event",
    });
    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.messages[0]).toMatchObject({
      id: "user-1",
      status: "final",
    });
    expect(snapshot.messages[1]).toMatchObject({
      id: "assistant-1",
      status: "error",
      parts: [{ type: "text", text: "partial reply" }],
    });
  });
});

describe("DefaultNcpAgentConversationStateManager hydration", () => {
  it("reset clears messages, streaming state, error, active run, and tool tracking", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-1",
        runId: "run-6",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-6",
        toolCallId: "tool-6",
        toolName: "search",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallArgsDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-6",
        toolCallId: "tool-6",
        delta: '{"q":"demo"}',
      },
    });
    manager.dispatch({
      type: NcpEventType.EndpointError,
      payload: {
        code: "config-error",
        message: "failed",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "user-6",
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        }),
      },
    });

    manager.reset();

    expect(manager.getSnapshot()).toEqual({
      messages: [],
      streamingMessage: null,
      error: null,
      activeRun: null,
    });

    manager.dispatch({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-6",
        content: { ok: true },
      },
    });
    expect(manager.getSnapshot().streamingMessage?.id).toBe("tool-tool-6");
  });
});

describe("DefaultNcpAgentConversationStateManager hydration", () => {
  it("hydrate restores history and resets live run state", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.hydrate({
      sessionId: "session-2",
      messages: [
        createMessage({
          id: "user-2",
          sessionId: "session-2",
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        }),
        createMessage({
          id: "assistant-2",
          sessionId: "session-2",
          parts: [{ type: "text", text: "partial" }],
          status: "streaming",
        }),
      ],
    });

    expect(manager.getSnapshot()).toEqual({
      messages: [
        createMessage({
          id: "user-2",
          sessionId: "session-2",
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        }),
        createMessage({
          id: "assistant-2",
          sessionId: "session-2",
          parts: [{ type: "text", text: "partial" }],
          status: "streaming",
        }),
      ],
      streamingMessage: null,
      error: null,
      activeRun: null,
    });
  });

  it("hydrate restores a provided live run state", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.hydrate({
      sessionId: "session-2",
      messages: [
        createMessage({
          id: "assistant-2",
          sessionId: "session-2",
          parts: [{ type: "text", text: "still running" }],
          status: "streaming",
        }),
      ],
      activeRun: {
        runId: null,
      },
    });

    expect(manager.getSnapshot()).toEqual({
      messages: [
        createMessage({
          id: "assistant-2",
          sessionId: "session-2",
          parts: [{ type: "text", text: "still running" }],
          status: "streaming",
        }),
      ],
      streamingMessage: null,
      error: null,
      activeRun: {
        runId: null,
        sessionId: "session-2",
        abortDisabledReason: null,
      },
    });
  });

  it("hydrate strips leaked reply tags from assistant history", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.hydrate({
      sessionId: "session-4",
      messages: [
        createMessage({
          id: "assistant-4",
          sessionId: "session-4",
          parts: [{ type: "text", text: "[[reply_to: message-9]] hello" }],
        }),
      ],
    });

    expect(manager.getSnapshot().messages).toEqual([
      createMessage({
        id: "assistant-4",
        sessionId: "session-4",
        parts: [{ type: "text", text: "hello" }],
        metadata: {
          reply_to: "message-9",
        },
      }),
    ]);
  });

  it("promotes hydrated message into streaming state when a new live stream continues with the same message id", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.hydrate({
      sessionId: "session-3",
      messages: [
        createMessage({
          id: "assistant-3",
          sessionId: "session-3",
          parts: [{ type: "text", text: "partial" }],
          status: "streaming",
        }),
      ],
    });

    manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-3",
        messageId: "assistant-3",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-3",
        messageId: "assistant-3",
        delta: " reply",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-3",
        runId: "run-3",
      },
    });

    const snapshot = manager.getSnapshot();
    expect(snapshot.streamingMessage).toBeNull();
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]).toMatchObject({
      id: "assistant-3",
      status: "final",
      parts: [{ type: "text", text: "partial reply" }],
    });
  });
});
