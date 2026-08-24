import { describe, expect, it } from "vitest";
import { type NcpMessage, NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "./agent-conversation-state.manager.js";

const createMessage = (overrides: Partial<NcpMessage> = {}): NcpMessage => ({
  id: "msg-1",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  parts: [],
  timestamp: "2026-03-12T00:00:00.000Z",
  ...overrides,
});

describe("DefaultNcpAgentConversationStateManager settlement", () => {
  it("finalizes one assistant message without settling the active run", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    await manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: { sessionId: "session-1", runId: "run-1" },
    });
    await manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: { sessionId: "session-1", messageId: "assistant-1", delta: "first" },
    });
    await manager.dispatch({
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "assistant-1",
          parts: [{ type: "text", text: "first" }],
        }),
      },
    });

    expect(manager.getSnapshot()).toMatchObject({
      activeRun: { runId: "run-1" },
      messages: [{ id: "assistant-1", status: "final" }],
      streamingMessage: null,
    });
  });

  it("settles replayed assistant in its timeline position when later user messages arrive", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "first" }],
          timestamp: "2026-03-12T00:00:00.000Z",
        }),
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "assistant-1",
          status: "streaming",
          parts: [{ type: "text", text: "working" }],
          timestamp: "2026-03-12T00:00:01.000Z",
        }),
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
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "later" }],
          timestamp: "2026-03-12T00:00:02.000Z",
        }),
      },
    });

    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });

    expect(manager.getSnapshot().messages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
      "user-2",
    ]);
  });
});

describe("DefaultNcpAgentConversationStateManager metadata settlement", () => {
  it("settles assistant message lifecycle from run timing facts", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
        startedAt: "2026-03-12T00:00:00.000Z",
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
        delta: "done",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
        metadata: {
          run_trigger: {
            version: 1,
            actor: "agent",
            source: "sessions_spawn",
            triggeredAt: "2026-03-12T00:00:00.000Z",
            targetRunId: "run-1",
            sourceSessionId: "parent-session",
            sourceMessageId: "parent-user-message",
            sourceRunId: "parent-run",
            sourceToolCallId: "tool-call-1",
            sourceRequestId: "request-1",
            sourceModel: "openai/gpt-5.6",
          },
          ai_execution: {
            version: 1,
            runId: "run-1",
            runtimeId: "native",
            model: "openai/gpt-5",
            requestedModel: null,
            outcome: "completed",
            usage: {
              inputTokens: 120,
              outputTokens: 30,
              cachedInputTokens: 20,
              totalTokens: 150,
              modelCallCount: 1,
              reportedModelCallCount: 1,
              status: "reported",
            },
          },
        },
      },
    });
    manager.dispatch({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
        startedAt: "2026-03-12T00:00:00.000Z",
        endedAt: "2026-03-12T00:03:51.000Z",
      },
    });

    expect(manager.getSnapshot().messages[0]?.lifecycle).toEqual({
      startedAt: "2026-03-12T00:00:00.000Z",
      endedAt: "2026-03-12T00:03:51.000Z",
    });
    expect(manager.getSnapshot().messages[0]?.metadata?.ai_execution).toMatchObject({
      runId: "run-1",
      runtimeId: "native",
      model: "openai/gpt-5",
      outcome: "completed",
      usage: {
        inputTokens: 120,
        outputTokens: 30,
        status: "reported",
      },
    });
    expect(manager.getSnapshot().messages[0]?.metadata?.run_trigger).toMatchObject({
      actor: "agent",
      source: "sessions_spawn",
      targetRunId: "run-1",
      sourceModel: "openai/gpt-5.6",
    });
  });

  it("does not leak trigger provenance into the next run", async () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    await manager.dispatchBatch([
      {
        type: NcpEventType.RunStarted,
        payload: { sessionId: "session-1", runId: "run-1" },
      },
      {
        type: NcpEventType.RunMetadata,
        payload: {
          sessionId: "session-1",
          runId: "run-1",
          metadata: {
            run_trigger: {
              version: 1,
              actor: "automation",
              source: "observation",
              triggeredAt: "2026-03-12T00:00:00.000Z",
              targetRunId: "run-1",
            },
          },
        },
      },
      {
        type: NcpEventType.MessageCompleted,
        payload: {
          sessionId: "session-1",
          message: createMessage({ id: "assistant-1" }),
        },
      },
      {
        type: NcpEventType.RunStarted,
        payload: { sessionId: "session-1", runId: "run-2" },
      },
      {
        type: NcpEventType.MessageCompleted,
        payload: {
          sessionId: "session-1",
          message: createMessage({ id: "assistant-2" }),
        },
      },
    ]);

    expect(manager.getSnapshot().messages[0]?.metadata?.run_trigger).toBeDefined();
    expect(manager.getSnapshot().messages[1]?.metadata?.run_trigger).toBeUndefined();
  });
});

describe("DefaultNcpAgentConversationStateManager outcome settlement", () => {
  it("projects execution metadata when an assistant run is aborted", () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: { sessionId: "session-1", runId: "run-abort" },
    });
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-abort",
        delta: "partial",
      },
    });
    manager.dispatch({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId: "session-1",
        runId: "run-abort",
        metadata: {
          ai_execution: {
            version: 1,
            runId: "run-abort",
            runtimeId: "codex",
            model: "gpt-5",
            requestedModel: null,
            outcome: "aborted",
            usage: {
              inputTokens: null,
              outputTokens: null,
              cachedInputTokens: null,
              totalTokens: null,
              modelCallCount: null,
              reportedModelCallCount: null,
              status: "unavailable",
            },
          },
        },
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-abort",
        runId: "run-abort",
      },
    });

    expect(manager.getSnapshot().messages[0]).toMatchObject({
      id: "assistant-abort",
      status: "final",
      metadata: {
        ai_execution: {
          runId: "run-abort",
          outcome: "aborted",
          usage: { status: "unavailable" },
        },
      },
    });
  });
});

describe("DefaultNcpAgentConversationStateManager error settlement", () => {
  it("keeps recovered runtime interruption typed instead of exposing it as a task failure", () => {
    const manager = new DefaultNcpAgentConversationStateManager();

    manager.dispatch({
      type: NcpEventType.RunError,
      payload: {
        error: "Run interrupted: internal recovery detail.",
        interrupted: true,
        runId: "run-interrupted-1",
        sessionId: "session-1",
      },
    });

    expect(manager.getSnapshot().error).toMatchObject({
      code: "run-interrupted",
      message: "Run interrupted: internal recovery detail.",
    });
  });

  it("cancels unfinished tool calls when a run settles with an error", () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    manager.dispatch({
      type: NcpEventType.MessageTextDelta,
      payload: { sessionId: "session-1", messageId: "assistant-error", delta: "partial" },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-error",
        toolCallId: "tool-interrupted",
        toolName: "command_execution",
      },
    });
    manager.dispatch({
      type: NcpEventType.MessageToolCallEnd,
      payload: { sessionId: "session-1", toolCallId: "tool-interrupted" },
    });
    manager.dispatch({
      type: NcpEventType.RunError,
      payload: { sessionId: "session-1", error: "interrupted" },
    });

    expect(manager.getSnapshot().messages[0]).toMatchObject({
      id: "assistant-error",
      status: "error",
      parts: [
        { type: "text", text: "partial" },
        { type: "tool-invocation", toolCallId: "tool-interrupted", state: "cancelled" },
      ],
    });
  });
});
