import { describe, expect, it, vi } from "vitest";
import {
  estimateInputTokens,
  type ContextCompactionCheckpoint,
} from "@nextclaw/core";
import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";

const SESSION_ID = "session-summary-budget";

function createAgentManager(): AgentManager {
  return {
    resolveAgentProfileForRun: () => ({
      id: "main",
      default: true,
      workspace: "",
      model: "test-model",
      contextTokens: 35_000,
      reservedContextTokens: 7_000,
      displayName: "Main",
      builtIn: true,
    }),
  } as AgentManager;
}

function createAssistantMessage(id: string, text: string, timestamp: string): NcpMessage {
  return {
    id,
    sessionId: SESSION_ID,
    role: "assistant",
    status: "final",
    timestamp,
    parts: [{ type: "text", text }],
  };
}

function createService(providerManager: object): ContextCompactionPreflightService {
  return new ContextCompactionPreflightService(createAgentManager(), providerManager as never);
}

function beginCompaction(service: ContextCompactionPreflightService) {
  return service.begin({
    contextBlocks: ["fixed context ".repeat(7_200)],
    inputMessages: [],
    model: "run-selected-model",
    requestMetadata: {},
    sessionId: SESSION_ID,
    sessionMessages: [
      createAssistantMessage(
        "large-previous-reply",
        "covered history ".repeat(8_000),
        "2026-06-05T17:13:00.000Z",
      ),
      createAssistantMessage("current-message", "continue", "2026-06-05T17:14:00.000Z"),
    ],
    storedAgentId: "main",
    storedMetadata: {},
    trigger: "manual" as const,
  });
}

function createSummaryResponse(content: string) {
  return {
    content,
    finishReason: "stop",
    reasoningContent: null,
    toolCalls: [],
    usage: {},
  };
}

describe("ContextCompactionPreflightService summary budget", () => {
  it("installs a provider summary above the soft target when it fits the hard budget", async () => {
    let targetSummaryTokens = 0;
    const providerManager = {
      chat: vi.fn(async (request: { messages: Array<{ content?: string }> }) => {
        targetSummaryTokens = Number(
          (request.messages[1]?.content ?? "").match(/within (\d+) tokens/)?.[1] ?? 0,
        );
        let summary = "# Compressed Working Context\n\n## Continuation Contract\nContinue.\n\n";
        while (estimateInputTokens(summary) <= Math.floor(targetSummaryTokens * 1.2)) {
          summary += "Preserved context. ";
        }
        return createSummaryResponse(summary);
      }),
    };
    const service = createService(providerManager);
    const finishResult = await service.finish(beginCompaction(service).pendingCompaction!);
    const checkpoint = finishResult.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;

    expect(estimateInputTokens(checkpoint.summary)).toBeGreaterThan(targetSummaryTokens);
    expect(finishResult.contextWindow.usedContextTokens).toBeLessThanOrEqual(28_000);
  });

  it("fits a complete provider summary above the hard budget without another model call", async () => {
    const providerManager = {
      chat: vi.fn(async () => createSummaryResponse([
        "# Compressed Working Context",
        "## Active Task & User Intent\nKeep the rolling task and its latest evidence.",
        `## Recent High-Fidelity Context\n${"oversized ".repeat(20_000)}`,
        "## Continuation Contract\nContinue the same run after installing this checkpoint.",
      ].join("\n\n"))),
    };
    const service = createService(providerManager);
    const finishResult = await service.finish(beginCompaction(service).pendingCompaction!);
    const checkpoint = finishResult.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;

    expect(providerManager.chat).toHaveBeenCalledTimes(1);
    expect(checkpoint).toMatchObject({ status: "compressed" });
    expect(checkpoint.summary).toMatch(/^# Compressed Working Context/);
    expect(checkpoint.summary).toContain("Continuation Contract");
    expect(checkpoint.summary).toContain("omitted to fit the checkpoint budget");
    expect(finishResult.contextWindow.usedContextTokens).toBeLessThanOrEqual(28_000);
  });
});
