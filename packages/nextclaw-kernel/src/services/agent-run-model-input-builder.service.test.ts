import { describe, expect, it, vi } from "vitest";
import type { ContextCompactionCheckpoint } from "@nextclaw/core";
import type { NcpMessage, OpenAIChatMessage } from "@nextclaw/ncp";
import {
  buildContextCompactionModelInput,
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

function createAgentManager(contextTokens: number): AgentManager {
  return {
    resolveAgentProfile: () => ({
      contextTokens,
      reservedContextTokens: 0,
    }),
    resolveAgentProfileForRun: () => ({
      id: "researcher",
      default: true,
      workspace: "",
      model: "test-model",
      contextTokens,
      reservedContextTokens: 0,
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
        buildContextCompactionModelInput({
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

  it("keeps compressed context ahead of oversized bootstrap context when real pruning runs", async () => {
    const checkpoint = createCheckpoint();
    const sourceMessages = [
      createTimelineMessage(checkpoint),
      createUserMessage("你好"),
    ];
    const messageProjector = {
      project: vi.fn(() =>
        buildContextCompactionModelInput({
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
});

describe("AgentRunModelInputBuilder deterministic compaction integration", () => {
  it("builds a continuation-safe final input after deterministic preflight compaction", async () => {
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
        `Durable project rules. ${"static context ".repeat(1_500)}`,
      ].join("\n"),
    ];
    const sessionMessages = [
      createSessionMessage({
        id: "old-user",
        role: "user",
        text: `《天脊书》第一卷前八章已经完成，下一步继续第九章。${"novel context ".repeat(10_000)}`,
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
    const agentManager = createAgentManager(10_000);
    const providerManager = {
      chat: vi.fn(async () => ({
        content: [
          "# Compressed Working Context",
          "",
          "## Continuation Contract",
          "When the user says 你好, continue 《天脊书》 and ask whether to write Chapter 9 or Volume 2.",
        ].join("\n"),
      })),
    };
    const preflight = new ContextCompactionPreflightService(agentManager, providerManager as never);
    const begin = preflight.begin({
      contextBlocks,
      inputMessages: [],
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages,
      storedAgentId: "researcher",
      storedMetadata: {},
    });
    expect(begin.pendingCompaction).not.toBeNull();
    const finish = await preflight.finish(begin.pendingCompaction!);
    const modelInput = await new AgentRunModelInputBuilder(
      {
        project: vi.fn(() =>
          buildContextCompactionModelInput({
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
  });
});
