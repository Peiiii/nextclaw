import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { SessionContextWindowContribution } from "@kernel/contributions/session-context-window/index.js";
import { NcpEventType } from "@nextclaw/ncp";
import { EventBus, eventKeys } from "@nextclaw/shared";

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createKernelStub(
  contextWindow: Record<string, unknown>,
  liveSessionRecord: Record<string, unknown> | null = null,
) {
  const eventBus = new EventBus();
  const getContextWindow = vi.fn().mockResolvedValue(contextWindow);
  const getLiveSessionRecord = vi.fn(() => liveSessionRecord);
  const publishedContextWindows: Record<string, unknown>[] = [];
  eventBus.on(eventKeys.ncpEvent, (event) => {
    if (event.type === NcpEventType.ContextWindowUpdated) {
      publishedContextWindows.push(event.payload.contextWindow);
    }
  });
  return {
    eventBus,
    getContextWindow,
    publishedContextWindows,
    kernel: {
      eventBus,
      ncpSessionManager: {
        getContextWindow,
      },
      sessionRunManager: {
        getLiveSessionRecord,
      },
    } as unknown as NextclawKernel,
    getLiveSessionRecord,
  };
}

describe("SessionContextWindowContribution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes a throttled context-window update while the assistant streams", async () => {
    const { eventBus, getContextWindow, kernel, publishedContextWindows } = createKernelStub({
      usedContextTokens: 64,
      totalContextTokens: 100,
    });
    const contribution = new SessionContextWindowContribution(kernel);
    contribution.start();

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        delta: "hello",
      },
    });

    await vi.advanceTimersByTimeAsync(1499);
    expect(getContextWindow).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(getContextWindow).toHaveBeenCalledWith("session-1", null);
    expect(publishedContextWindows).toContainEqual({
      usedContextTokens: 64,
      totalContextTokens: 100,
    });
    contribution.dispose();
  });

  it("uses the live session snapshot when publishing context-window updates", async () => {
    const liveSessionRecord = {
      sessionId: "session-1",
      messages: [],
      metadata: { runtime: "native" },
    };
    const { eventBus, getContextWindow, getLiveSessionRecord, kernel } = createKernelStub({
      usedContextTokens: 32,
      totalContextTokens: 100,
    }, liveSessionRecord);
    const contribution = new SessionContextWindowContribution(kernel);
    contribution.start();

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-1",
        content: "tool output",
      },
    });
    await vi.advanceTimersByTimeAsync(1500);

    expect(getLiveSessionRecord).toHaveBeenCalledWith("session-1");
    expect(getContextWindow).toHaveBeenCalledWith("session-1", liveSessionRecord);
    contribution.dispose();
  });

  it("flushes immediately when the run finishes", async () => {
    const { eventBus, kernel, publishedContextWindows } = createKernelStub({
      usedContextTokens: 88,
      totalContextTokens: 100,
    });
    const contribution = new SessionContextWindowContribution(kernel);
    contribution.start();

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
      },
    });
    await flushPromises();

    expect(publishedContextWindows).toContainEqual({
      usedContextTokens: 88,
      totalContextTokens: 100,
    });
    contribution.dispose();
  });

  it("publishes immediately after a user message is persisted", async () => {
    const { eventBus, kernel, publishedContextWindows } = createKernelStub({
      usedContextTokens: 24,
      totalContextTokens: 100,
    });
    const contribution = new SessionContextWindowContribution(kernel);
    contribution.start();

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: {
          id: "user-1",
          sessionId: "session-1",
          role: "user",
          status: "final",
          parts: [{ type: "text", text: "hello" }],
          timestamp: "2026-05-19T00:00:00.000Z",
        },
      },
    });
    await flushPromises();

    expect(publishedContextWindows).toContainEqual({
      usedContextTokens: 24,
      totalContextTokens: 100,
    });
    contribution.dispose();
  });

  it("refreshes after non-delta tool stream events", async () => {
    const { eventBus, getContextWindow, kernel, publishedContextWindows } = createKernelStub({
      usedContextTokens: 72,
      totalContextTokens: 100,
    });
    const contribution = new SessionContextWindowContribution(kernel);
    contribution.start();

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        toolCallId: "tool-1",
        toolName: "exec",
      },
    });

    await vi.advanceTimersByTimeAsync(1500);

    expect(getContextWindow).toHaveBeenCalledWith("session-1", null);
    expect(publishedContextWindows).toContainEqual({
      usedContextTokens: 72,
      totalContextTokens: 100,
    });
    contribution.dispose();
  });

  it("does not republish an unchanged context-window snapshot", async () => {
    const contextWindow = {
      usedContextTokens: 42,
      totalContextTokens: 100,
    };
    const { eventBus, getContextWindow, kernel, publishedContextWindows } = createKernelStub(contextWindow);
    const contribution = new SessionContextWindowContribution(kernel);
    contribution.start();

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        sessionId: "session-1",
        contextWindow,
      },
    });
    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-1",
        message: {
          id: "assistant-1",
          sessionId: "session-1",
          role: "assistant",
          status: "final",
          parts: [{ type: "text", text: "done" }],
          timestamp: "2026-05-19T00:00:00.000Z",
        },
      },
    });
    await flushPromises();

    expect(getContextWindow).toHaveBeenCalledWith("session-1", null);
    expect(publishedContextWindows).toHaveLength(1);
    contribution.dispose();
  });
});
