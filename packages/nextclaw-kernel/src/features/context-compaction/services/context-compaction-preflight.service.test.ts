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

    expect(projectedMessages[0]?.parts[0]).toMatchObject({ type: "text", text: checkpoint.summary });
    expect(projectedMessages.map((message) => message.id)).not.toContain("current-user");
    expect(projectedMessages.map((message) => message.id)).not.toContain("covered-old-0");
    expect(projectedMessages.map((message) => message.id)).toContain("assistant-after");
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
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages,
      storedAgentId: "main",
      storedMetadata: {
        [CONTEXT_COMPACTION_METADATA_KEY]: existingCheckpoint,
      },
    });

    expect(beginResult.pendingCompaction).not.toBeNull();
    expect(beginResult.timelineMessage?.id).toMatch(/^context-compaction-message-/);
    expect(beginResult.timelineMessage?.id).not.toBe(`${SESSION_ID}:service:context-compaction:${existingCheckpoint.id}:17`);
    const compressingCheckpoint = beginResult.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;
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
    expect(summaryRequest).toContain("after checkpoint 15");
    expect(finishResult.timelineMessage?.id).toBe(beginResult.timelineMessage?.id);
    expect(finishResult.metadataPatch[CONTEXT_COMPACTION_METADATA_KEY]).toMatchObject({
      coveredMessageCount: compressingCheckpoint.coveredMessageCount,
      coveredSessionMessageCount: compressingCheckpoint.coveredSessionMessageCount,
      id: existingCheckpoint.id,
      status: "compressed",
      summary: "# Compressed Earlier Context\n\nRolled forward.",
    });
    expect(finishResult.contextWindow.usedContextTokens).toBeLessThan(beginResult.contextWindow.usedContextTokens);
  });
});
