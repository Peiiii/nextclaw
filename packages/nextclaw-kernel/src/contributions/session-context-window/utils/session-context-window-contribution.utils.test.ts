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

function createKernelStub(contextWindow: Record<string, unknown>) {
  const eventBus = new EventBus();
  const appendSessionEvent = vi.fn().mockResolvedValue(undefined);
  const getSession = vi.fn().mockResolvedValue({
    sessionId: "session-1",
    messageCount: 1,
    updatedAt: "2026-05-19T00:00:00.000Z",
    status: "running",
    contextWindow,
  });
  return {
    eventBus,
    appendSessionEvent,
    getSession,
    kernel: {
      eventBus,
      ncpSessionApi: {
        getSession,
      },
      sessionRunManager: {
        appendSessionEvent,
      },
    } as unknown as NextclawKernel,
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
    const { appendSessionEvent, eventBus, getSession, kernel } = createKernelStub({
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
    expect(getSession).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(getSession).toHaveBeenCalledWith("session-1");
    expect(appendSessionEvent).toHaveBeenCalledWith("session-1", {
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        sessionId: "session-1",
        contextWindow: {
          usedContextTokens: 64,
          totalContextTokens: 100,
        },
      },
    });
    contribution.dispose();
  });

  it("flushes immediately when the run finishes", async () => {
    const { appendSessionEvent, eventBus, kernel } = createKernelStub({
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

    expect(appendSessionEvent).toHaveBeenCalledWith("session-1", {
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        sessionId: "session-1",
        contextWindow: {
          usedContextTokens: 88,
          totalContextTokens: 100,
        },
      },
    });
    contribution.dispose();
  });

  it("does not republish an unchanged context-window snapshot", async () => {
    const contextWindow = {
      usedContextTokens: 42,
      totalContextTokens: 100,
    };
    const { appendSessionEvent, eventBus, getSession, kernel } = createKernelStub(contextWindow);
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

    expect(getSession).toHaveBeenCalledWith("session-1");
    expect(appendSessionEvent).not.toHaveBeenCalled();
    contribution.dispose();
  });
});
