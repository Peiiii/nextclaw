import { describe, expect, it, vi } from "vitest";
import {
  estimateInputTokens,
  type ContextCompactionCheckpoint,
} from "@nextclaw/core";
import type { NcpMessage, OpenAIChatMessage } from "@nextclaw/ncp";
import {
  buildContextCompactionModelProjection,
  buildContextCompactionTimelineNcpMessage,
  ContextCompactionPreflightService,
} from "@kernel/features/context-compaction/index.js";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { AgentRunMessageProjector } from "./agent-run-message-projector.service.js";
import { AgentRunModelInputBudgeter } from "./agent-run-model-input-budgeter.service.js";
import { AgentRunModelInputBuilder } from "./agent-run-model-input-builder.service.js";

const SESSION_ID = "session-compacted-model-input";

function createCheckpoint(): ContextCompactionCheckpoint {
  return {
    version: 1,
    id: "ctx-compacted",
    status: "compressed",
    summary: "# Compressed Working Context\n\n## Continuation Contract\nContinue 《天脊书》 instead of restarting onboarding.",
    coveredMessageCount: 4,
    coveredSessionMessageCount: 4,
    originalEstimatedTokens: 20_000,
    projectedEstimatedTokens: 900,
    coveredUntil: "2026-06-05T17:12:00.000Z",
    createdAt: "2026-06-05T17:12:01.000Z",
    updatedAt: "2026-06-05T17:12:02.000Z",
  };
}

function createTimelineMessage(checkpoint: ContextCompactionCheckpoint): NcpMessage {
  return buildContextCompactionTimelineNcpMessage({
    checkpoint,
    messageId: "context-compaction-message-1",
    sessionId: SESSION_ID,
  });
}

function createUserMessage(text: string): NcpMessage {
  return {
    id: "current-user",
    sessionId: SESSION_ID,
    role: "user",
    status: "final",
    timestamp: "2026-06-05T17:12:03.000Z",
    parts: [{ type: "text", text }],
  };
}

function createSessionMessage(params: {
  id: string;
  role: "user" | "assistant";
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

function createFinalImageToolMessage(): NcpMessage {
  return {
    id: "assistant-image-tool",
    sessionId: SESSION_ID,
    role: "assistant",
    status: "final",
    timestamp: "2026-06-05T17:12:02.000Z",
    parts: [
      {
        type: "tool-invocation",
        toolName: "view_image",
        toolCallId: "call-image",
        state: "result",
        args: { path: "/tmp/screen.png" },
        result: {
          ok: true,
          path: "/tmp/screen.png",
          image: { type: "image", dataOmitted: true },
        },
        resultContentItems: [
          {
            type: "input_image",
            imageUrl: `data:image/png;base64,${"a".repeat(2_500_000)}`,
            mimeType: "image/png",
          },
        ],
      },
    ],
  };
}

function createAgentManager(contextTokens: number, reservedContextTokens = 0): AgentManager {
  return {
    resolveAgentProfile: () => ({
      contextTokens,
      reservedContextTokens,
    }),
    resolveAgentProfileForRun: () => ({
      id: "researcher",
      default: true,
      workspace: "",
      model: "test-model",
      contextTokens,
      reservedContextTokens,
      displayName: "Researcher",
      builtIn: true,
    }),
  } as AgentManager;
}

describe("AgentRunModelInputBuilder", () => {
  it("folds compressed conversation context into the leading system block", async () => {
    const checkpoint = createCheckpoint();
    const sourceMessages = [
      createTimelineMessage(checkpoint),
      createUserMessage("你好"),
    ];
    const messageProjector = {
      project: vi.fn(() =>
        buildContextCompactionModelProjection({
          sessionId: SESSION_ID,
          sessionMessages: sourceMessages,
        }),
      ),
    } as unknown as AgentRunMessageProjector;
    const modelInputBudgeter = {
      prune: vi.fn(async ({ messages }: { messages: readonly OpenAIChatMessage[] }) => ({
        messages: [...messages],
      })),
    } as unknown as AgentRunModelInputBudgeter;

    const input = await new AgentRunModelInputBuilder(
      messageProjector,
      modelInputBudgeter,
    ).build({
      spec: {
        runId: "run-1",
        agentId: "researcher",
        model: "test-model",
      },
      sessionId: SESSION_ID,
      messages: sourceMessages,
      contextBlocks: [
        [
          "# Agent Bootstrap Context",
          "",
          "Agent bootstrap files loaded:",
          "",
          "## AGENTS.md",
          "",
          "Durable project rules.",
          "",
          "## BOOTSTRAP.md",
          "",
          "You just woke up. Ask the user for a name before doing anything.",
          "",
          "## IDENTITY.md",
          "",
          "Fill this in during your first conversation.",
        ].join("\n"),
      ],
      tools: [],
    });

    const systemMessages = input.messages.filter((message) => message.role === "system");
    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0]?.content).toContain("Durable project rules.");
    expect(systemMessages[0]?.content).not.toContain("BOOTSTRAP.md");
    expect(systemMessages[0]?.content).not.toContain("You just woke up");
    expect(systemMessages[0]?.content).not.toContain("IDENTITY.md");
    expect(systemMessages[0]?.content).toContain("Authoritative compressed prior conversation context");
    expect(systemMessages[0]?.content).toContain("Continue 《天脊书》 instead of restarting onboarding");
    expect(String(systemMessages[0]?.content).indexOf("Authoritative compressed prior conversation context")).toBeLessThan(
      String(systemMessages[0]?.content).indexOf("Durable project rules."),
    );
    expect(input.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: "你好",
        }),
      ]),
    );
  });

});

describe("AgentRunModelInputBuilder mid-run continuation", () => {
  it("continues a mid-run checkpoint without replaying covered tool parts", async () => {
    const checkpoint: ContextCompactionCheckpoint = {
      ...createCheckpoint(),
      phase: "mid-run",
      continuationMessageId: "active-assistant",
      continuationMessageCoveredPartCount: 1,
      preservedUserMessageIds: ["active-user"],
    };
    const sourceMessages: NcpMessage[] = [
      createSessionMessage({
        id: "active-user",
        role: "user",
        text: "PRESERVED_EXACT_USER_CONSTRAINT",
        timestamp: "2026-06-05T17:11:59.000Z",
      }),
      {
        id: "active-assistant",
        sessionId: SESSION_ID,
        role: "assistant",
        status: "streaming",
        timestamp: "2026-06-05T17:12:00.000Z",
        parts: [
          {
            type: "tool-invocation",
            toolName: "lookup",
            toolCallId: "covered-call",
            state: "result",
            args: { query: "covered" },
            result: { canary: "COVERED_TOOL_RESULT" },
          },
          { type: "text", text: "New output after compaction." },
        ],
      },
      createTimelineMessage(checkpoint),
    ];
    const messageProjector = {
      project: vi.fn(() =>
        buildContextCompactionModelProjection({
          sessionId: SESSION_ID,
          sessionMessages: sourceMessages,
        }),
      ),
    } as unknown as AgentRunMessageProjector;
    const modelInputBudgeter = {
      prune: vi.fn(async ({ messages }: { messages: readonly OpenAIChatMessage[] }) => ({
        messages: [...messages],
      })),
    } as unknown as AgentRunModelInputBudgeter;

    const input = await new AgentRunModelInputBuilder(
      messageProjector,
      modelInputBudgeter,
    ).build({
      spec: {
        runId: "run-1",
        agentId: "researcher",
        model: "test-model",
      },
      sessionId: SESSION_ID,
      messages: sourceMessages,
      contextBlocks: [],
      tools: [],
    });

    expect(input.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: "user",
        content: "PRESERVED_EXACT_USER_CONSTRAINT",
      }),
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("Continue the active run"),
      }),
      expect.objectContaining({
        role: "assistant",
        content: "New output after compaction.",
      }),
    ]));
    expect(input.messages.some((message) => message.role === "tool")).toBe(false);
    expect(JSON.stringify(input.messages)).not.toContain("COVERED_TOOL_RESULT");
    expect(modelInputBudgeter.prune).toHaveBeenCalledWith(expect.objectContaining({
      protectedPrefixMessageCount: 3,
      protectedSystemContentChars: expect.any(Number),
    }));
  });
});

describe("AgentRunModelInputBuilder budget pruning", () => {
  it("keeps compressed context ahead of oversized bootstrap context when real pruning runs", async () => {
    const checkpoint = createCheckpoint();
    const sourceMessages = [
      createTimelineMessage(checkpoint),
      createUserMessage("你好"),
    ];
    const messageProjector = {
      project: vi.fn(() =>
        buildContextCompactionModelProjection({
          sessionId: SESSION_ID,
          sessionMessages: sourceMessages,
        }),
      ),
    } as unknown as AgentRunMessageProjector;
    const agentManager = {
      resolveAgentProfile: () => ({
        contextTokens: 2_000,
        reservedContextTokens: 0,
      }),
    } as AgentManager;
    const hugeContext = [
      "# Agent Bootstrap Context",
      "",
      "Agent bootstrap files loaded:",
      "",
      "## BOOTSTRAP.md",
      "",
      "You just woke up. Ask the user for a name before doing anything.",
      "",
      "## AGENTS.md",
      "",
      `Durable project rules. ${"static context ".repeat(4_000)}`,
    ].join("\n");

    const input = await new AgentRunModelInputBuilder(
      messageProjector,
      new AgentRunModelInputBudgeter(agentManager),
    ).build({
      spec: {
        runId: "run-1",
        agentId: "researcher",
        model: "test-model",
      },
      sessionId: SESSION_ID,
      messages: sourceMessages,
      contextBlocks: [hugeContext],
      tools: [],
    });

    const systemContent = String(input.messages.find((message) => message.role === "system")?.content ?? "");
    expect(systemContent).toContain("Authoritative compressed prior conversation context");
    expect(systemContent).toContain("Continue 《天脊书》 instead of restarting onboarding");
    expect(systemContent).not.toContain("BOOTSTRAP.md");
    expect(systemContent).not.toContain("You just woke up");
    expect(input.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: "你好",
        }),
      ]),
    );
  });

  it("keeps session history when a final historical visual tool result is oversized", async () => {
    const sourceMessages = [
      createSessionMessage({
        id: "matrix-user-1",
        role: "user",
        text: "给我搞下一部《黑客帝国》。然后放给我",
        timestamp: "2026-06-05T17:12:00.000Z",
      }),
      createSessionMessage({
        id: "matrix-user-2",
        role: "user",
        text: "第一步，不要再问我了，全部完成。",
        timestamp: "2026-06-05T17:12:01.000Z",
      }),
      createFinalImageToolMessage(),
      createSessionMessage({
        id: "matrix-user-3",
        role: "user",
        text: "注意，我说的是下载到本地。",
        timestamp: "2026-06-05T17:12:03.000Z",
      }),
    ];
    const messageProjector = {
      project: vi.fn(() => ({
        messages: sourceMessages,
        stablePrefixMessageCount: 0,
      })),
    } as unknown as AgentRunMessageProjector;

    const input = await new AgentRunModelInputBuilder(
      messageProjector,
      new AgentRunModelInputBudgeter(createAgentManager(200_000)),
    ).build({
      spec: {
        runId: "run-1",
        agentId: "researcher",
        model: "test-model",
      },
      sessionId: SESSION_ID,
      messages: sourceMessages,
      contextBlocks: ["BOOTSTRAP CONTEXT"],
      tools: [],
    });

    expect(input.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: "给我搞下一部《黑客帝国》。然后放给我",
        }),
        expect.objectContaining({
          role: "user",
          content: "第一步，不要再问我了，全部完成。",
        }),
        expect.objectContaining({
          role: "user",
          content: "注意，我说的是下载到本地。",
        }),
      ]),
    );
    expect(JSON.stringify(input.messages)).not.toContain("data:image/png;base64");
  });

  it("fails explicitly when a compressed stable prefix cannot fit the provider budget", async () => {
    const budgeter = new AgentRunModelInputBudgeter(createAgentManager(100));

    await expect(budgeter.prune({
      spec: {
        runId: "run-1",
        agentId: "researcher",
        model: "test-model",
      },
      messages: [
        { role: "system", content: "compressed summary ".repeat(100) },
        { role: "user", content: "exact preserved user constraint" },
      ],
      protectedPrefixMessageCount: 2,
      protectedSystemContentChars: "compressed summary ".repeat(100).length,
    })).rejects.toThrow("compressed-context stable prefix");
  });

  it("includes tool schemas when enforcing the compressed stable-prefix budget", async () => {
    const checkpoint = createCheckpoint();
    const messages = [createTimelineMessage(checkpoint), createUserMessage("continue")];
    const builder = new AgentRunModelInputBuilder(
      {
        project: vi.fn(() => buildContextCompactionModelProjection({
          sessionId: SESSION_ID,
          sessionMessages: messages,
        })),
      } as unknown as AgentRunMessageProjector,
      new AgentRunModelInputBudgeter(createAgentManager(1_000)),
    );

    await expect(builder.build({
      spec: {
        runId: "run-1",
        agentId: "researcher",
        model: "test-model",
      },
      sessionId: SESSION_ID,
      messages,
      contextBlocks: [],
      tools: [{
        name: "large_tool",
        description: "schema ".repeat(1_000),
        parameters: { type: "object", properties: {} },
      }] as never,
    })).rejects.toThrow("compressed-context stable prefix");
  });

  it("fails explicitly when tool schemas and the latest input cannot fit before any checkpoint exists", async () => {
    const budgeter = new AgentRunModelInputBudgeter(createAgentManager(300));

    await expect(budgeter.prune({
      spec: {
        runId: "run-1",
        agentId: "researcher",
        model: "test-model",
      },
      fixedInputTokens: 400,
      messages: [{ role: "user", content: "latest input" }],
    })).rejects.toThrow("configured context window");
  });
});

describe("AgentRunModelInputBuilder deterministic compaction integration", () => {
  it("fits an oversized optional tail and builds the continuation-safe final provider input", async () => {
    const contextBlocks = [
      [
        "# Agent Bootstrap Context",
        "",
        "Agent bootstrap files loaded:",
        "",
        "## BOOTSTRAP.md",
        "",
        "You just woke up. Ask the user for a name before doing anything.",
        "",
        "## IDENTITY.md",
        "",
        "Fill this in during your first conversation.",
        "",
        "## AGENTS.md",
        "",
        `Durable project rules. ${"static context ".repeat(6_800)}`,
      ].join("\n"),
    ];
    const sessionMessages = [
      createSessionMessage({
        id: "old-user",
        role: "user",
        text: `《天脊书》第一卷前八章已经完成，下一步继续第九章。${"novel context ".repeat(5_000)}`,
        timestamp: "2026-06-05T17:12:00.000Z",
      }),
      createSessionMessage({
        id: "old-assistant",
        role: "assistant",
        text: "已了解《天脊书》上下文。",
        timestamp: "2026-06-05T17:12:01.000Z",
      }),
      createSessionMessage({
        id: "current-user",
        role: "user",
        text: "你好",
        timestamp: "2026-06-05T17:12:02.000Z",
      }),
    ];
    const agentManager = createAgentManager(35_000, 7_000);
    let targetSummaryTokens = 0;
    const providerManager = {
      chat: vi.fn(async (request: { messages: Array<{ content?: string }> }) => {
        const prompt = request.messages[1]?.content ?? "";
        targetSummaryTokens = Number(prompt.match(/within (\d+) tokens/)?.[1] ?? 0);
        let content = [
          "# Compressed Working Context",
          "## Active Request\n\nContinue 《天脊书》 from the current task.",
          "## Current Work State\n\nThe first eight chapters are complete.",
          "## Safety and User Constraints\n\nDo not restart onboarding.",
          "## Continuation Contract\n\nWhen the user says 你好, continue 《天脊书》 and ask whether to write Chapter 9 or Volume 2.\n<!-- nextclaw-essential-context-complete -->",
          "## Critical Technical Context\n\nPreserved working context.",
        ].join("\n\n");
        while (estimateInputTokens(content) <= Math.floor(targetSummaryTokens * 1.2)) {
          content += "\nPreserved working context.";
        }
        content += "\n<!-- nextclaw-section-complete:critical-technical-context -->";
        return {
          content,
          finishReason: "stop",
          reasoningContent: null,
          toolCalls: [],
          usage: {},
        };
      }),
    };
    const preflight = new ContextCompactionPreflightService(agentManager, providerManager as never);
    const begin = preflight.begin({
      contextBlocks,
      inputMessages: [],
      model: "test-model",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages,
      storedAgentId: "researcher",
      storedMetadata: {},
    });
    expect(begin.pendingCompaction).not.toBeNull();
    const finish = await preflight.finish(begin.pendingCompaction!);
    const checkpoint = finish.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;
    expect(targetSummaryTokens).toBeGreaterThan(0);
    expect(estimateInputTokens(checkpoint.summary)).toBeLessThanOrEqual(targetSummaryTokens);
    expect(checkpoint.summary).not.toContain("Critical Technical Context");
    const modelInput = await new AgentRunModelInputBuilder(
      {
        project: vi.fn(() =>
          buildContextCompactionModelProjection({
            sessionId: SESSION_ID,
            sessionMessages: [
              ...sessionMessages,
              finish.timelineMessage!,
            ],
          }),
        ),
      } as unknown as AgentRunMessageProjector,
      new AgentRunModelInputBudgeter(agentManager),
    ).build({
      spec: {
        runId: "run-1",
        agentId: "researcher",
        model: "test-model",
      },
      sessionId: SESSION_ID,
      messages: [
        ...sessionMessages,
        finish.timelineMessage!,
      ],
      contextBlocks,
      tools: [],
    });

    const systemContent = String(modelInput.messages.find((message) => message.role === "system")?.content ?? "");
    expect(systemContent).toContain("Authoritative compressed prior conversation context");
    expect(systemContent).toContain("When the user says 你好, continue 《天脊书》");
    expect(systemContent).not.toContain("BOOTSTRAP.md");
    expect(systemContent).not.toContain("You just woke up");
    expect(systemContent).not.toContain("IDENTITY.md");
    expect(modelInput.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: "你好",
        }),
      ]),
    );
    expect(finish.contextWindow.usedContextTokens).toBeLessThanOrEqual(28_000);
  });
});
