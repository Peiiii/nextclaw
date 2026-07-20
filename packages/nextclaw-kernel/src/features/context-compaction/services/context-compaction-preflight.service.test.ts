import { describe, expect, it, vi } from "vitest";
import {
  CONTEXT_COMPACTION_METADATA_KEY,
  type ContextCompactionCheckpoint,
} from "@nextclaw/core";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  buildContextCompactionModelInput,
  buildContextCompactionTimelineNcpMessage,
} from "@kernel/features/context-compaction/utils/context-compaction.utils.js";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";

const SESSION_ID = "session-rolling-compaction";

function createAgentManager(): AgentManager {
  return {
    resolveAgentProfileForRun: () => ({
      id: "main",
      default: true,
      workspace: "",
      model: "test-model",
      contextTokens: 1_000,
      reservedContextTokens: 0,
      displayName: "Main",
      builtIn: true,
    }),
  } as AgentManager;
}

function createCheckpoint(): ContextCompactionCheckpoint {
  return {
    version: 1,
    id: "ctx-existing",
    status: "compressed",
    summary: "Previously compressed context.",
    coveredMessageCount: 8,
    coveredSessionMessageCount: 8,
    originalEstimatedTokens: 900,
    projectedEstimatedTokens: 100,
    createdAt: "2026-06-05T17:12:16.116Z",
    updatedAt: "2026-06-05T17:12:17.484Z",
  };
}

function createTimelineMessage(checkpoint: ContextCompactionCheckpoint): NcpMessage {
  return buildContextCompactionTimelineNcpMessage({
    checkpoint,
    messageId: `context-compaction-message-${checkpoint.coveredSessionMessageCount}`,
    sessionId: SESSION_ID,
  });
}

function createUserMessage(index: number): NcpMessage {
  return {
    id: `message-after-${index}`,
    sessionId: SESSION_ID,
    role: "user",
    status: "final",
    timestamp: `2026-06-05T17:${String(20 + index).padStart(2, "0")}:00.000Z`,
    parts: [{ type: "text", text: `after checkpoint ${index} ${"x".repeat(480)}` }],
  };
}

function createAssistantMessage(params: {
  id: string;
  text: string;
  timestamp: string;
}): NcpMessage {
  return {
    id: params.id,
    sessionId: SESSION_ID,
    role: "assistant",
    status: "final",
    timestamp: params.timestamp,
    parts: [{ type: "text", text: params.text }],
  };
}

describe("ContextCompactionPreflightService", () => {
  it("creates a compaction plan for short history only when manually triggered", () => {
    const service = new ContextCompactionPreflightService(createAgentManager());
    const sessionMessages = [
      createAssistantMessage({
        id: "older-assistant",
        text: "A short prior answer.",
        timestamp: "2026-06-05T17:12:18.000Z",
      }),
      createAssistantMessage({
        id: "latest-assistant",
        text: "The latest answer.",
        timestamp: "2026-06-05T17:12:19.000Z",
      }),
    ];
    const input = {
      inputMessages: [],
      model: "test-model",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages,
      storedAgentId: "main",
      storedMetadata: {},
    };

    expect(service.begin(input).pendingCompaction).toBeNull();
    expect(service.begin({ ...input, trigger: "manual" }).pendingCompaction).not.toBeNull();
  });

  it("projects from the checkpoint timestamp when replay order leaves old messages after the marker", () => {
    const existingCheckpoint = createCheckpoint();
    const service = new ContextCompactionPreflightService(createAgentManager());

    const contextWindow = service.preview({
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages: [
        createTimelineMessage(existingCheckpoint),
        createAssistantMessage({
          id: "old-large-after-marker",
          text: "old ".repeat(20_000),
          timestamp: "2026-06-05T17:12:16.999Z",
        }),
        createAssistantMessage({
          id: "new-tail",
          text: "new tail",
          timestamp: "2026-06-05T17:12:18.000Z",
        }),
      ],
      storedAgentId: "main",
      storedMetadata: {
        [CONTEXT_COMPACTION_METADATA_KEY]: existingCheckpoint,
      },
    });

    expect(contextWindow?.usedContextTokens).toBeLessThan(1_000);
  });

  it("falls back to the timeline checkpoint when metadata is stuck in compressing", () => {
    const existingCheckpoint = createCheckpoint();
    const service = new ContextCompactionPreflightService(createAgentManager());

    const contextWindow = service.preview({
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages: [
        createTimelineMessage(existingCheckpoint),
        createAssistantMessage({
          id: "old-large-after-marker",
          text: "old ".repeat(20_000),
          timestamp: "2026-06-05T17:12:16.999Z",
        }),
      ],
      storedAgentId: "main",
      storedMetadata: {
        [CONTEXT_COMPACTION_METADATA_KEY]: {
          ...existingCheckpoint,
          status: "compressing",
          updatedAt: "2026-06-05T17:13:00.000Z",
        },
      },
    });

    expect(contextWindow).toMatchObject({
      compacted: true,
      checkpointId: existingCheckpoint.id,
      compactedMessageCount: existingCheckpoint.coveredMessageCount,
    });
    expect(contextWindow?.usedContextTokens).toBeLessThan(1_000);
  });

  it("builds model input from summary plus checkpoint-after messages", () => {
    const checkpoint = {
      ...createCheckpoint(),
      updatedAt: "2026-06-05T17:13:00.000Z",
    };

    const projectedMessages = buildContextCompactionModelInput({
      sessionId: SESSION_ID,
      sessionMessages: [
        ...Array.from({ length: 8 }, (_, index) => createAssistantMessage({
          id: `covered-old-${index}`,
          text: `covered ${index}`,
          timestamp: `2026-06-05T17:12:0${index}.000Z`,
        })),
        {
          id: "current-user",
          sessionId: SESSION_ID,
          role: "user",
          status: "final",
          timestamp: "2026-06-05T17:12:59.000Z",
          parts: [{ type: "text", text: "please use a modern stack" }],
        },
        createTimelineMessage(checkpoint),
        createAssistantMessage({
          id: "assistant-after",
          text: "done",
          timestamp: "2026-06-05T17:13:01.000Z",
        }),
      ],
    });

    expect(projectedMessages[0]).toMatchObject({ role: "service" });
    expect(projectedMessages[0]?.parts[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Authoritative compressed prior conversation context"),
    });
    expect(projectedMessages[0]?.parts[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining(checkpoint.summary),
    });
    expect(projectedMessages.map((message) => message.id)).not.toContain("current-user");
    expect(projectedMessages.map((message) => message.id)).not.toContain("covered-old-0");
    expect(projectedMessages.map((message) => message.id)).toContain("assistant-after");
  });

  it("uses coveredUntil as the compressed boundary so retained current messages stay raw", () => {
    const checkpoint = {
      ...createCheckpoint(),
      coveredUntil: "2026-06-05T17:12:30.000Z",
      updatedAt: "2026-06-05T17:13:00.000Z",
    };

    const projectedMessages = buildContextCompactionModelInput({
      sessionId: SESSION_ID,
      sessionMessages: [
        createAssistantMessage({
          id: "covered-old",
          text: "covered old",
          timestamp: "2026-06-05T17:12:00.000Z",
        }),
        {
          id: "current-user",
          sessionId: SESSION_ID,
          role: "user",
          status: "final",
          timestamp: "2026-06-05T17:12:59.000Z",
          parts: [{ type: "text", text: "please keep this raw" }],
        },
        createTimelineMessage(checkpoint),
      ],
    });

    expect(projectedMessages.map((message) => message.id)).not.toContain("covered-old");
    expect(projectedMessages.map((message) => message.id)).toContain("current-user");
  });

  it("compacts short sessions when context blocks push the run over budget", () => {
    const service = new ContextCompactionPreflightService(createAgentManager());
    const beginResult = service.begin({
      contextBlocks: ["context ".repeat(4_000)],
      inputMessages: [],
      model: "run-selected-model",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages: [
        createAssistantMessage({
          id: "intro",
          text: "intro",
          timestamp: "2026-06-05T17:12:00.000Z",
        }),
        createAssistantMessage({
          id: "large-previous-reply",
          text: "chapter ".repeat(3_000),
          timestamp: "2026-06-05T17:13:00.000Z",
        }),
        createAssistantMessage({
          id: "current-message",
          text: "hello again",
          timestamp: "2026-06-05T17:14:00.000Z",
        }),
      ],
      storedAgentId: "main",
      storedMetadata: {},
    });

    expect(beginResult.pendingCompaction).not.toBeNull();
    expect(beginResult.pendingCompaction?.plan.retainedMessages.map((message) => message.ncp_message_id)).toEqual([
      "current-message",
    ]);
    expect(beginResult.pendingCompaction?.plan.coveredMessages.map((message) => message.ncp_message_id)).toContain(
      "large-previous-reply",
    );
  });
});

describe("ContextCompactionPreflightService rolling source", () => {
  it("strips reasoning tags before storing generated summaries", async () => {
    const providerManager = {
      chat: vi.fn(async () => ({
        content: "<think>hidden compaction reasoning</think>\n\n# Compressed Working Context\n\n## Continuation Contract\nKeep continuing 《天脊书》.",
      })),
    };
    const service = new ContextCompactionPreflightService(createAgentManager(), providerManager as never);
    const beginResult = service.begin({
      contextBlocks: ["context ".repeat(4_000)],
      inputMessages: [],
      model: "run-selected-model",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages: [
        createAssistantMessage({
          id: "large-previous-reply",
          text: "chapter ".repeat(3_000),
          timestamp: "2026-06-05T17:13:00.000Z",
        }),
        createAssistantMessage({
          id: "current-message",
          text: "hello again",
          timestamp: "2026-06-05T17:14:00.000Z",
        }),
      ],
      storedAgentId: "main",
      storedMetadata: {},
    });

    const finishResult = await service.finish(beginResult.pendingCompaction!);
    const checkpoint = finishResult.metadataPatch[CONTEXT_COMPACTION_METADATA_KEY] as ContextCompactionCheckpoint;
    expect(checkpoint.summary).toBe("# Compressed Working Context\n\n## Continuation Contract\nKeep continuing 《天脊书》.");
    expect(checkpoint.summary).not.toContain("<think>");
  });

  it("keeps recent covered message heads when summary source is truncated", async () => {
    const providerManager = {
      chat: vi.fn(async () => ({ content: "# Compressed Working Context\n\nKept source canaries." })),
    };
    const service = new ContextCompactionPreflightService(createAgentManager(), providerManager as never);
    const sessionMessages = Array.from({ length: 12 }, (_, index) =>
      createAssistantMessage({
        id: `large-history-${index}`,
        text: [
          index === 0 ? "CANARY_ALPHA_731" : `large ${index}`,
          index === 8 ? "CANARY_RECENT_842" : "",
          "x".repeat(30_000),
        ].join("\n"),
        timestamp: `2026-06-05T17:${String(12 + index).padStart(2, "0")}:00.000Z`,
      }),
    );

    const beginResult = service.begin({
      inputMessages: [],
      model: "run-selected-model",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages,
      storedAgentId: "main",
      storedMetadata: {},
    });

    await service.finish(beginResult.pendingCompaction!);

    const summaryRequest = providerManager.chat.mock.calls[0]?.[0].messages[1]?.content ?? "";
    const summarySystemPrompt = providerManager.chat.mock.calls[0]?.[0].messages[0]?.content ?? "";
    expect(summarySystemPrompt).toContain("Continuation Contract");
    expect(summarySystemPrompt).toContain("does not restart as a fresh session");
    expect(summaryRequest).toContain("Continuation Contract");
    expect(summaryRequest).toContain("CANARY_ALPHA_731");
    expect(summaryRequest).toContain("CANARY_RECENT_842");
  });

  it("creates a new compaction plan when a compressed session exceeds the context window again", async () => {
    const existingCheckpoint = createCheckpoint();
    const providerManager = {
      chat: vi.fn(async () => ({ content: "# Compressed Earlier Context\n\nRolled forward." })),
    };
    const service = new ContextCompactionPreflightService(createAgentManager(), providerManager as never);
    const sessionMessages = [
      createTimelineMessage(existingCheckpoint),
      ...Array.from({ length: 16 }, (_, index) => createUserMessage(index)),
    ];

    const beginResult = service.begin({
      inputMessages: [],
      model: "run-selected-model",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages,
      storedAgentId: "main",
      storedMetadata: {
        [CONTEXT_COMPACTION_METADATA_KEY]: existingCheckpoint,
      },
    });

    expect(beginResult.pendingCompaction).not.toBeNull();
    const pendingCompaction = beginResult.pendingCompaction!;
    expect(pendingCompaction.serviceMessageId).toMatch(/^context-compaction-message-/);
    expect(pendingCompaction.serviceMessageId).not.toBe(`${SESSION_ID}:service:context-compaction:${existingCheckpoint.id}:17`);
    const compressingCheckpoint = pendingCompaction.checkpoint;
    expect(compressingCheckpoint.coveredMessageCount).toBeGreaterThan(existingCheckpoint.coveredMessageCount);
    expect(compressingCheckpoint.coveredSessionMessageCount).toBe(compressingCheckpoint.coveredMessageCount);
    expect(compressingCheckpoint).toMatchObject({
      id: existingCheckpoint.id,
      status: "compressing",
    });

    const finishResult = await service.finish(beginResult.pendingCompaction!);

    expect(providerManager.chat).toHaveBeenCalledOnce();
    const summaryRequest = providerManager.chat.mock.calls[0]?.[0].messages[1]?.content ?? "";
    expect(summaryRequest).toContain("Previously compressed context.");
    expect(summaryRequest).toContain("after checkpoint 14");
    expect(summaryRequest).not.toContain("after checkpoint 15");
    expect(finishResult.timelineMessage?.id).toBe(pendingCompaction.serviceMessageId);
    expect(finishResult.metadataPatch[CONTEXT_COMPACTION_METADATA_KEY]).toMatchObject({
      coveredMessageCount: compressingCheckpoint.coveredMessageCount,
      coveredSessionMessageCount: compressingCheckpoint.coveredSessionMessageCount,
      coveredUntil: "2026-06-05T17:34:00.000Z",
      id: existingCheckpoint.id,
      status: "compressed",
      summary: "# Compressed Earlier Context\n\nRolled forward.",
    });
    const projectedAfterFinish = buildContextCompactionModelInput({
      sessionId: SESSION_ID,
      sessionMessages: [
        ...sessionMessages,
        finishResult.timelineMessage!,
      ],
    });
    expect(projectedAfterFinish.map((message) => message.id)).toContain("message-after-15");
    expect(projectedAfterFinish.map((message) => message.id)).not.toContain("message-after-14");
    expect(finishResult.contextWindow.usedContextTokens).toBeLessThan(beginResult.contextWindow.usedContextTokens);
  });
});
