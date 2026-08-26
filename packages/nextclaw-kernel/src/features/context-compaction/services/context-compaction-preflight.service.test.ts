import { describe, expect, it, vi } from "vitest";
import {
  CONTEXT_COMPACTION_METADATA_KEY,
  ContextWindowBudgetService,
  estimateInputTokens,
  type ContextCompactionCheckpoint,
} from "@nextclaw/core";
import { ncpMessageToOpenAiMessages } from "@nextclaw/ncp-agent-runtime";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  buildContextCompactionModelProjection,
  buildContextCompactionTimelineNcpMessage,
} from "@kernel/features/context-compaction/utils/context-compaction.utils.js";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";

const SESSION_ID = "session-rolling-compaction";
function protocolSummary(detail = "The active task continues."): string {
  return [
    "# Compressed Working Context",
    "## Active Request\n\nPreserve the active request.",
    "## Current Work State\n\nThe current work is in progress.",
    "## Safety and User Constraints\n\nKeep the user's constraints.",
    `## Continuation Contract\n\n${detail}`,
    "<!-- nextclaw-essential-context-complete -->",
  ].join("\n\n");
}

const VALID_SUMMARY = protocolSummary("Continue the active task.");

function createSummaryResponse(
  content: string | null = VALID_SUMMARY,
  finishReason = "stop",
) {
  return {
    content,
    finishReason,
    reasoningContent: null,
    toolCalls: [],
    usage: {},
  };
}

function createAgentManager(contextTokens = 1_000, reservedContextTokens = 0): AgentManager {
  return {
    resolveAgentProfileForRun: () => ({
      id: "main",
      default: true,
      workspace: "",
      model: "test-model",
      contextTokens,
      reservedContextTokens,
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
  it("estimates tool results from the provider projection without counting stored content twice", () => {
    const repeatedResult = "expensive result ".repeat(2_000);
    const message: NcpMessage = {
      id: "assistant-tool-result",
      sessionId: SESSION_ID,
      role: "assistant",
      status: "final",
      timestamp: "2026-06-05T17:12:18.000Z",
      parts: [{
        type: "tool-invocation",
        toolName: "read_file",
        toolCallId: "call-read",
        state: "result",
        args: { path: "/tmp/large.txt" },
        result: repeatedResult,
        resultContentItems: [{ type: "input_text", text: repeatedResult }],
      }],
    };
    const service = new ContextCompactionPreflightService(
      createAgentManager(100_000),
    );

    const preview = service.preview({
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages: [message],
      storedAgentId: "main",
      storedMetadata: {},
    });
    const expected = new ContextWindowBudgetService().evaluate({
      messages: ncpMessageToOpenAiMessages(message),
      contextTokens: 100_000,
      reservedContextTokens: 0,
    });

    expect(preview?.usedContextTokens).toBe(expected.estimatedTokens);
    expect(preview?.usedContextTokens).toBeLessThan(
      estimateInputTokens([repeatedResult, repeatedResult]),
    );
  });

  it("does not call the summary provider when tool schemas already exhaust the compacted input budget", async () => {
    const providerManager = {
      chat: vi.fn(async () => createSummaryResponse()),
    };
    const service = new ContextCompactionPreflightService(
      createAgentManager(),
      providerManager as never,
    );
    const begin = service.begin({
      inputMessages: [],
      model: "test-model",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages: [
        createAssistantMessage({
          id: "large-history",
          text: "history ".repeat(1_000),
          timestamp: "2026-06-05T17:12:18.000Z",
        }),
        createUserMessage(1),
      ],
      storedAgentId: "main",
      storedMetadata: {},
      tools: [{
        name: "large_tool",
        description: "schema ".repeat(1_000),
        parameters: { type: "object", properties: {} },
      }] as never,
    });

    await expect(service.finish(begin.pendingCompaction!)).rejects.toThrow(
      "cannot fit a usable summary",
    );
    expect(providerManager.chat).not.toHaveBeenCalled();
  });

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

    const { messages: projectedMessages } = buildContextCompactionModelProjection({
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

    const { messages: projectedMessages } = buildContextCompactionModelProjection({
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

});

describe("ContextCompactionPreflightService fixed input", () => {
  it("keeps runtime and session-preview budget snapshots identical", () => {
    const service = new ContextCompactionPreflightService(createAgentManager(35_000));
    const sessionMessages = [createUserMessage(1)];
    const runtimeSnapshot = service.preview({
      contextBlocks: ["system context ".repeat(2_000)],
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages,
      storedAgentId: "main",
      storedMetadata: {},
      tools: [{
        name: "lookup",
        description: "lookup schema ".repeat(500),
        parameters: { type: "object", properties: {} },
      }],
    });
    const sessionSnapshot = service.preview({
      fixedInputTokens: runtimeSnapshot!.fixedInputTokens,
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages,
      storedAgentId: "main",
      storedMetadata: {},
    });

    expect(sessionSnapshot).toMatchObject({
      usedContextTokens: runtimeSnapshot?.usedContextTokens,
      fixedInputTokens: runtimeSnapshot?.fixedInputTokens,
      dynamicInputTokens: runtimeSnapshot?.dynamicInputTokens,
      reservedContextTokens: runtimeSnapshot?.reservedContextTokens,
      triggerContextTokens: runtimeSnapshot?.triggerContextTokens,
      availableBeforeCompactionTokens: runtimeSnapshot?.availableBeforeCompactionTokens,
    });
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

describe("context compaction preserved-user projection", () => {
  it("reprojects checkpoint-preserved user messages and applies the boundary truncation", () => {
    const checkpoint: ContextCompactionCheckpoint = {
      ...createCheckpoint(),
      coveredUntil: "2026-06-05T17:12:30.000Z",
      preservedUserMessageIds: ["preserved-full", "preserved-truncated"],
      truncatedPreservedUserMessage: {
        messageId: "preserved-truncated",
        text: "TRUNCATED_HEAD…80 tokens truncated…TRUNCATED_TAIL",
      },
    };
    const preservedFull: NcpMessage = {
      id: "preserved-full",
      sessionId: SESSION_ID,
      role: "user",
      status: "final",
      timestamp: "2026-06-05T17:12:00.000Z",
      parts: [{ type: "text", text: "FULL_EXACT_USER_CONSTRAINT" }],
    };
    const preservedTruncated: NcpMessage = {
      ...preservedFull,
      id: "preserved-truncated",
      timestamp: "2026-06-05T17:12:10.000Z",
      parts: [{ type: "text", text: `TRUNCATED_HEAD${"x".repeat(2_000)}TRUNCATED_TAIL` }],
    };

    const { messages: projectedMessages } = buildContextCompactionModelProjection({
      sessionId: SESSION_ID,
      sessionMessages: [
        preservedFull,
        preservedTruncated,
        createAssistantMessage({
          id: "covered-assistant",
          text: "do not replay this",
          timestamp: "2026-06-05T17:12:20.000Z",
        }),
        createTimelineMessage(checkpoint),
      ],
    });

    expect(projectedMessages.map((message) => message.id)).toEqual([
      expect.stringContaining("context-compaction-summary"),
      "preserved-full",
      "preserved-truncated",
    ]);
    expect(projectedMessages[1]?.parts).toEqual([
      { type: "text", text: "FULL_EXACT_USER_CONSTRAINT" },
    ]);
    expect(projectedMessages[2]?.parts).toEqual([
      { type: "text", text: "TRUNCATED_HEAD…80 tokens truncated…TRUNCATED_TAIL" },
    ]);
  });

  it("keeps the checkpoint stable prefix identical while later messages append", () => {
    const checkpoint: ContextCompactionCheckpoint = {
      ...createCheckpoint(),
      coveredUntil: "2026-06-05T17:12:30.000Z",
      preservedUserMessageIds: ["preserved-user"],
      retainedMessageIds: ["retained-current-user"],
      updatedAt: "2026-06-05T17:13:00.000Z",
    };
    const preservedUser: NcpMessage = {
      id: "preserved-user",
      sessionId: SESSION_ID,
      role: "user",
      status: "final",
      timestamp: "2026-06-05T17:12:00.000Z",
      parts: [{ type: "text", text: "PRESERVED_EXACT_USER_CONSTRAINT" }],
    };
    const retainedUser: NcpMessage = {
      ...preservedUser,
      id: "retained-current-user",
      timestamp: "2026-06-05T17:12:59.000Z",
      parts: [{ type: "text", text: "CURRENT_EXACT_USER_REQUEST" }],
    };
    const timeline = createTimelineMessage(checkpoint);
    const firstProjection = buildContextCompactionModelProjection({
      sessionId: SESSION_ID,
      sessionMessages: [preservedUser, retainedUser, timeline],
    });
    const secondProjection = buildContextCompactionModelProjection({
      sessionId: SESSION_ID,
      sessionMessages: [
        preservedUser,
        retainedUser,
        timeline,
        createAssistantMessage({
          id: "dynamic-assistant",
          text: "new output after checkpoint",
          timestamp: "2026-06-05T17:13:01.000Z",
        }),
      ],
    });

    expect(firstProjection.stablePrefixMessageCount).toBe(3);
    expect(secondProjection.stablePrefixMessageCount).toBe(3);
    expect(
      secondProjection.messages.slice(0, secondProjection.stablePrefixMessageCount),
    ).toEqual(firstProjection.messages);
    expect(secondProjection.messages.at(-1)?.id).toBe("dynamic-assistant");
  });
});

describe("ContextCompactionPreflightService mid-run compaction", () => {
  it("records a part boundary and keeps only later parts after mid-run compaction", async () => {
    const providerManager = {
      chat: vi.fn(async (request: { maxTokens: number }) => ({
        ...createSummaryResponse(protocolSummary("Continue after the lookup.")),
        finishReason: request.maxTokens < 8_000 ? "length" : "stop",
      })),
    };
    const service = new ContextCompactionPreflightService(createAgentManager(35_000, 7_000), providerManager as never);
    const activeAssistant: NcpMessage = {
      id: "active-assistant",
      sessionId: SESSION_ID,
      role: "assistant",
      status: "streaming",
      timestamp: "2026-06-05T17:14:00.000Z",
      parts: [
        { type: "text", text: "Working. ".repeat(12_000) },
        {
          type: "tool-invocation",
          toolName: "lookup",
          toolCallId: "call-1",
          state: "result",
          args: { query: "context compaction" },
          result: { ok: true },
        },
      ],
    };
    const activeUser: NcpMessage = {
      id: "active-user",
      sessionId: SESSION_ID,
      role: "user",
      status: "final",
      timestamp: "2026-06-05T17:13:59.000Z",
      parts: [{ type: "text", text: "Keep this exact user constraint." }],
    };
    const beginResult = service.begin({
      contextBlocks: ["fixed context ".repeat(7_200)],
      inputMessages: [],
      model: "run-selected-model",
      phase: "mid-run",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages: [activeUser, activeAssistant],
      storedAgentId: "main",
      storedMetadata: {},
    });

    expect(beginResult.pendingCompaction?.plan.retainedMessages).toEqual([]);
    expect(beginResult.pendingCompaction?.checkpoint).toMatchObject({ status: "compressing", phase: "mid-run", continuationMessageId: "active-assistant", continuationMessageCoveredPartCount: 2 });
    const finishResult = await service.finish(beginResult.pendingCompaction!);
    const checkpoint = finishResult.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;
    expect(checkpoint).toMatchObject({
      phase: "mid-run",
      continuationMessageId: "active-assistant",
      continuationMessageCoveredPartCount: 2,
      preservedUserMessageIds: ["active-user"],
    });

    const { messages: projectedMessages } = buildContextCompactionModelProjection({
      sessionId: SESSION_ID,
      sessionMessages: [
        activeUser,
        {
          ...activeAssistant,
          parts: [
            ...activeAssistant.parts,
            { type: "text", text: "New model output after compaction." },
          ],
        },
        finishResult.timelineMessage!,
      ],
    });

    expect(projectedMessages[0]).toMatchObject({ role: "service" });
    expect(projectedMessages[1]).toMatchObject({
      id: "active-user",
      role: "user",
      parts: [{ type: "text", text: "Keep this exact user constraint." }],
    });
    expect(projectedMessages[2]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: expect.stringContaining("Continue the active run") }],
    });
    expect(projectedMessages[3]).toMatchObject({
      id: "active-assistant",
      parts: [{ type: "text", text: "New model output after compaction." }],
    });

    const rollingAssistant: NcpMessage = {
      ...activeAssistant,
      parts: [
        ...activeAssistant.parts,
        { type: "text", text: `SECOND_ROUND_CANARY ${"next ".repeat(25_000)}` },
      ],
    };
    const rollingBeginResult = service.begin({
      contextBlocks: ["fixed context ".repeat(7_200)],
      inputMessages: [],
      model: "run-selected-model",
      phase: "mid-run",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages: [activeUser, rollingAssistant, finishResult.timelineMessage!],
      storedAgentId: "main",
      storedMetadata: {
        [CONTEXT_COMPACTION_METADATA_KEY]: checkpoint,
      },
    });

    const rollingFinishResult = await service.finish(rollingBeginResult.pendingCompaction!);
    const rollingCheckpoint = rollingFinishResult.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;
    const rollingSummaryRequest = providerManager.chat.mock.calls[1]?.[0].messages[1]?.content ?? "";
    expect(rollingSummaryRequest).toContain("Continue after the lookup.");
    expect(rollingSummaryRequest).toContain("SECOND_ROUND_CANARY");
    expect(rollingSummaryRequest).not.toContain("Working. Working.");
    expect(rollingCheckpoint).toMatchObject({
      phase: "mid-run",
      continuationMessageId: "active-assistant",
      continuationMessageCoveredPartCount: 3,
    });
  });
});

describe("ContextCompactionPreflightService summary projection", () => {
  it("strips reasoning tags before storing generated summaries", async () => {
    const providerManager = {
      chat: vi.fn(async () => createSummaryResponse(
        `<think>hidden compaction reasoning</think>\n\n${protocolSummary("Keep continuing 《天脊书》.")}`,
      )),
    };
    const service = new ContextCompactionPreflightService(createAgentManager(20_000), providerManager as never);
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
      trigger: "manual",
    });

    const finishResult = await service.finish(beginResult.pendingCompaction!);
    const checkpoint = finishResult.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;
    expect(checkpoint.summary).toBe(protocolSummary("Keep continuing 《天脊书》."));
    expect(checkpoint.summary).not.toContain("<think>");
  });
  it("keeps recent covered message heads when summary source is truncated", async () => {
    const providerManager = {
      chat: vi.fn(async () => createSummaryResponse(
        protocolSummary("Continue."),
      )),
    };
    const service = new ContextCompactionPreflightService(createAgentManager(20_000), providerManager as never);
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
    const providerRequest = providerManager.chat.mock.calls[0]?.[0];
    expect(summarySystemPrompt).toContain("Continuation Contract");
    expect(summarySystemPrompt).toContain("A greeting does not erase the prior task");
    expect(summaryRequest).toContain("Complete the essential prefix first");
    expect(summaryRequest).toContain("CANARY_ALPHA_731");
    expect(summaryRequest).toContain("CANARY_RECENT_842");
    expect(
      estimateInputTokens(providerRequest?.messages ?? [])
      + (providerRequest?.maxTokens ?? 0),
    ).toBeLessThanOrEqual(20_000);
  });

  it("creates a new compaction plan when a compressed session exceeds the context window again", async () => {
    const existingCheckpoint = createCheckpoint();
    const providerManager = {
      chat: vi.fn(async () => createSummaryResponse(
        protocolSummary("Continue."),
      )),
    };
    const service = new ContextCompactionPreflightService(createAgentManager(20_000), providerManager as never);
    const sessionMessages = [
      createTimelineMessage(existingCheckpoint),
      ...Array.from({ length: 16 }, (_, index) => ({
        ...createUserMessage(index),
        parts: [{
          type: "text" as const,
          text: `after checkpoint ${index} ${"x".repeat(6_000)}`,
        }],
      })),
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
    expect(finishResult.timelineMessage?.metadata?.checkpoint).toMatchObject({
      coveredMessageCount: compressingCheckpoint.coveredMessageCount,
      coveredSessionMessageCount: compressingCheckpoint.coveredSessionMessageCount,
      coveredUntil: "2026-06-05T17:34:00.000Z",
      id: existingCheckpoint.id,
      status: "compressed",
      summary: protocolSummary("Continue."),
    });
    const { messages: projectedAfterFinish } = buildContextCompactionModelProjection({
      sessionId: SESSION_ID,
      sessionMessages: [
        ...sessionMessages,
        finishResult.timelineMessage!,
      ],
    });
    expect(projectedAfterFinish.map((message) => message.id)).toContain("message-after-15");
    expect(projectedAfterFinish.map((message) => message.id)).toContain("message-after-14");
    expect(projectedAfterFinish.map((message) => message.id)).not.toContain("message-after-0");
    expect(finishResult.contextWindow.usedContextTokens).toBeLessThan(beginResult.contextWindow.usedContextTokens);
  });
});
