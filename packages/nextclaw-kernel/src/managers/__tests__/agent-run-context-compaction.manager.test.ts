import { describe, expect, it, vi } from "vitest";
import {
  CONTEXT_COMPACTION_METADATA_KEY,
  type ContextCompactionCheckpoint,
} from "@nextclaw/core";
import type { NcpEndpointEvent, NcpMessage } from "@nextclaw/ncp";
import { buildContextCompactionTimelineNcpMessage } from "@kernel/features/context-compaction/index.js";
import { AgentRunContextCompactionManager } from "@kernel/managers/agent-run-context-compaction.manager.js";
import type { AgentManager } from "@kernel/managers/agent.manager.js";

const SESSION_ID = "session-context-compaction";
const VALID_SUMMARY = [
  "# Compressed Working Context",
  "## Active Request\n\nContinue the active task.",
  "## Current Work State\n\nThe task is in progress.",
  "## Safety and User Constraints\n\nKeep the user's constraints.",
  "## Continuation Contract\n\nProceed with the next required action.\n<!-- nextclaw-essential-context-complete -->",
].join("\n\n");

function createSummaryResponse(content = VALID_SUMMARY, finishReason = "stop") {
  return {
    content,
    finishReason,
    reasoningContent: null,
    toolCalls: [],
    usage: {},
  };
}

function createAgentManager(contextTokens = 1_000): AgentManager {
  return {
    resolveAgentProfileForRun: () => ({
      id: "main",
      default: true,
      workspace: "",
      model: "agent-default-model",
      contextTokens,
      reservedContextTokens: 0,
      displayName: "Main",
      builtIn: true,
    }),
  } as AgentManager;
}

function createMessage(params: {
  id: string;
  role: "assistant" | "user";
  text: string;
  timestamp: string;
}): NcpMessage {
  const { id, role, text, timestamp } = params;
  return {
    id,
    sessionId: SESSION_ID,
    role,
    status: "final",
    timestamp,
    parts: [{ type: "text", text }],
  };
}

function createFirstCompactionMessages(): NcpMessage[] {
  return [
    createMessage({
      id: "large-previous-reply",
      role: "assistant",
      text: "chapter ".repeat(3_000),
      timestamp: "2026-07-16T01:00:00.000Z",
    }),
    createMessage({
      id: "current-user-message",
      role: "user",
      text: "continue",
      timestamp: "2026-07-16T01:01:00.000Z",
    }),
  ];
}

function createExistingCheckpoint(): ContextCompactionCheckpoint {
  return {
    version: 1,
    id: "ctx-existing",
    status: "compressed",
    summary: "Previously compressed context.",
    coveredUntil: "2026-07-16T01:00:00.000Z",
    coveredMessageCount: 8,
    coveredSessionMessageCount: 8,
    originalEstimatedTokens: 900,
    projectedEstimatedTokens: 100,
    createdAt: "2026-07-16T01:00:00.000Z",
    updatedAt: "2026-07-16T01:00:00.000Z",
  };
}

function createManager(
  providerManager: object,
  contextTokens = 1_000,
) {
  return new AgentRunContextCompactionManager(
    createAgentManager(contextTokens),
    providerManager as never,
  );
}

async function collectEvents(
  events: AsyncIterable<NcpEndpointEvent>,
): Promise<NcpEndpointEvent[]> {
  const collected: NcpEndpointEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

describe("AgentRunContextCompactionManager", () => {
  it("manually compacts history below the automatic budget threshold", async () => {
    const providerManager = {
      chat: vi.fn(async () => createSummaryResponse()),
    };
    const manager = createManager(providerManager);
    const messages = [
      createMessage({
        id: "older-message",
        role: "assistant",
        text: "Short prior answer.",
        timestamp: "2026-07-16T01:00:00.000Z",
      }),
      createMessage({
        id: "current-message",
        role: "user",
        text: "Continue.",
        timestamp: "2026-07-16T01:01:00.000Z",
      }),
    ];

    await expect(collectEvents(manager.runPreflight({
      agentId: "main",
      contextBlocks: [],
      messages,
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    }))).resolves.toEqual([]);
    await expect(manager.runManual({
      agentId: "main",
      contextBlocks: [],
      messages,
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    })).resolves.toHaveLength(2);
  });

  it("publishes compressing before summary work and completes the same marker", async () => {
    let resolveSummary: ((value: ReturnType<typeof createSummaryResponse>) => void) | undefined;
    const summary = new Promise<ReturnType<typeof createSummaryResponse>>((resolve) => {
      resolveSummary = resolve;
    });
    const providerManager = {
      chat: vi.fn(async () => await summary),
    };
    const manager = createManager(providerManager, 20_000);

    const events = manager.runPreflight({
      agentId: "main",
      contextBlocks: ["runtime context ".repeat(4_000)],
      messages: createFirstCompactionMessages(),
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    })[Symbol.asyncIterator]();
    const compressing = await events.next();

    expect(providerManager.chat).not.toHaveBeenCalled();
    expect(compressing.value?.payload).toMatchObject({
      message: {
        metadata: {
          checkpoint: { status: "compressing" },
        },
      },
    });

    const completedPromise = events.next();
    await vi.waitFor(() => expect(providerManager.chat).toHaveBeenCalledWith(expect.objectContaining({
      model: "run-selected-model",
    })));
    resolveSummary?.(createSummaryResponse());
    const completed = await completedPromise;

    expect(completed.value?.payload).toMatchObject({
      message: {
        metadata: {
          checkpoint: { status: "compressed" },
        },
      },
    });
    const compressingMessage = "message" in compressing.value.payload
      ? compressing.value.payload.message
      : null;
    const completedMessage = "message" in completed.value.payload
      ? completed.value.payload.message
      : null;
    expect(completedMessage?.id).toBe(compressingMessage?.id);
    await expect(events.next()).resolves.toEqual({ done: true, value: undefined });
  });

  it("completes compaction when a structurally valid summary reaches the output limit", async () => {
    const providerManager = {
      chat: vi.fn(async () => createSummaryResponse([
        VALID_SUMMARY,
        "## Critical Technical Context",
        "oversized context ".repeat(20_000),
      ].join("\n\n"), "length")),
    };
    const manager = createManager(providerManager, 20_000);

    const events = await collectEvents(manager.runPreflight({
      agentId: "main",
      contextBlocks: ["runtime context ".repeat(4_000)],
      messages: createFirstCompactionMessages(),
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    }));

    expect(providerManager.chat).toHaveBeenCalledOnce();
    expect(events).toHaveLength(2);
    expect(events[1]?.payload).toMatchObject({
      message: {
        metadata: { checkpoint: { status: "compressed" } },
      },
    });
  });

  it("cancels an in-flight summary and terminalizes the same marker", async () => {
    const controller = new AbortController();
    const providerManager = {
      chat: vi.fn(async ({ signal }: { signal?: AbortSignal }) =>
        await new Promise<never>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
            once: true,
          });
        })),
    };
    const manager = createManager(providerManager, 20_000);
    const events = manager.runPreflight({
      agentId: "main",
      contextBlocks: ["runtime context ".repeat(4_000)],
      messages: createFirstCompactionMessages(),
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
      signal: controller.signal,
    })[Symbol.asyncIterator]();
    const compressing = await events.next();
    const cancelledPromise = events.next();

    await vi.waitFor(() => expect(providerManager.chat).toHaveBeenCalledWith(expect.objectContaining({
      signal: controller.signal,
    })));
    controller.abort();
    const cancelled = await cancelledPromise;
    const compressingMessageId = compressing.value && "message" in compressing.value.payload
      ? compressing.value.payload.message.id
      : undefined;

    expect(cancelled.value?.payload).toMatchObject({
      message: {
        id: compressingMessageId,
        metadata: {
          checkpoint: { status: "cancelled" },
        },
      },
    });
    await expect(events.next()).resolves.toEqual({ done: true, value: undefined });
  });

  it("does not persist a checkpoint when the first compaction fails", async () => {
    const providerManager = {
      chat: vi.fn(async () => {
        throw new Error("provider failed");
      }),
    };
    const manager = createManager(providerManager, 20_000);

    await expect(collectEvents(manager.runPreflight({
      agentId: "main",
      contextBlocks: ["runtime context ".repeat(4_000)],
      messages: createFirstCompactionMessages(),
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    }))).rejects.toThrow("provider failed");
    expect(providerManager.chat).toHaveBeenCalledOnce();
  });

  it("preserves the previous checkpoint when rolling compaction fails", async () => {
    const checkpoint = createExistingCheckpoint();
    const metadata = { [CONTEXT_COMPACTION_METADATA_KEY]: checkpoint };
    const providerManager = {
      chat: vi.fn(async () => {
        throw new Error("provider failed");
      }),
    };
    const manager = createManager(providerManager);
    const messages = [
      buildContextCompactionTimelineNcpMessage({
        checkpoint,
        messageId: "existing-compaction-message",
        sessionId: SESSION_ID,
      }),
      ...Array.from({ length: 16 }, (_, index) => createMessage({
        id: `message-after-${index}`,
        role: "user",
        text: `after checkpoint ${index} ${"x".repeat(480)}`,
        timestamp: `2026-07-16T01:${String(index + 2).padStart(2, "0")}:00.000Z`,
      })),
    ];

    await expect(collectEvents(manager.runPreflight({
      agentId: "main",
      contextBlocks: [],
      messages,
      metadata,
      model: "run-selected-model",
      sessionId: SESSION_ID,
    }))).rejects.toThrow("provider failed");
    expect(providerManager.chat).toHaveBeenCalledOnce();
    expect(metadata[CONTEXT_COMPACTION_METADATA_KEY]).toEqual(checkpoint);
  });

  it("recovers on retry without persisting the failed attempt", async () => {
    const providerManager = {
      chat: vi.fn()
        .mockRejectedValueOnce(new Error("provider failed"))
        .mockResolvedValueOnce(createSummaryResponse()),
    };
    const manager = createManager(providerManager, 20_000);
    const input = {
      agentId: "main",
      contextBlocks: ["runtime context ".repeat(4_000)],
      messages: createFirstCompactionMessages(),
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    };

    await expect(collectEvents(manager.runPreflight(input))).rejects.toThrow("provider failed");
    await expect(collectEvents(manager.runPreflight(input))).resolves.toHaveLength(2);
  });
});
