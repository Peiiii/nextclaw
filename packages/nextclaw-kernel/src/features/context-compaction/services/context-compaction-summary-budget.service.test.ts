import { describe, expect, it, vi } from "vitest";
import {
  estimateInputTokens,
  type ContextCompactionCheckpoint,
} from "@nextclaw/core";
import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";

const SESSION_ID = "session-summary-budget";

function protocolSummary(detail = "Continue the current task.", optional?: string): string {
  return [
    "# Compressed Working Context",
    "## Active Request\n\nPreserve the active request.",
    "## Current Work State\n\nThe current work is in progress.",
    "## Safety and User Constraints\n\nKeep the user's constraints.",
    `## Continuation Contract\n\n${detail}`,
    "<!-- nextclaw-essential-context-complete -->",
    optional
      ? `## Critical Technical Context\n\n${optional}\n<!-- nextclaw-section-complete:critical-technical-context -->`
      : "",
  ].filter(Boolean).join("\n\n");
}

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

function createSummaryResponse(content: string, finishReason = "stop") {
  return {
    content,
    finishReason,
    reasoningContent: null,
    toolCalls: [],
    usage: {},
  };
}

describe("ContextCompactionPreflightService summary budget", () => {
  it("drops a low-priority tail so the installed summary meets the target budget", async () => {
    let targetSummaryTokens = 0;
    const providerManager = {
      chat: vi.fn(async (request: { messages: Array<{ content?: string }> }) => {
        targetSummaryTokens = Number(
          (request.messages[1]?.content ?? "").match(/within (\d+) tokens/)?.[1] ?? 0,
        );
        return createSummaryResponse(protocolSummary(
          "Continue.",
          "Preserved low-priority context. ".repeat(targetSummaryTokens),
        ));
      }),
    };
    const service = createService(providerManager);
    const finishResult = await service.finish(beginCompaction(service).pendingCompaction!);
    const checkpoint = finishResult.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;

    expect(estimateInputTokens(checkpoint.summary)).toBeLessThanOrEqual(targetSummaryTokens);
    expect(checkpoint.summary).not.toContain("Critical Technical Context");
    expect(checkpoint.summaryDiagnostics).toMatchObject({
      attemptCount: 1,
      degraded: true,
      finishReason: "stop",
    });
    expect(finishResult.contextWindow.usedContextTokens).toBeLessThanOrEqual(28_000);
  });

  it("fits a complete provider summary above the hard budget without another model call", async () => {
    const providerManager = {
      chat: vi.fn(async () => createSummaryResponse(protocolSummary(
        "Continue the same run after installing this checkpoint.",
        "oversized ".repeat(20_000),
      ))),
    };
    const service = createService(providerManager);
    const finishResult = await service.finish(beginCompaction(service).pendingCompaction!);
    const checkpoint = finishResult.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;

    expect(providerManager.chat).toHaveBeenCalledTimes(1);
    expect(checkpoint).toMatchObject({ status: "compressed" });
    expect(checkpoint.summary).toMatch(/^# Compressed Working Context/);
    expect(checkpoint.summary).toContain("Continuation Contract");
    expect(checkpoint.summary).not.toContain("omitted to fit the checkpoint budget");
    expect(finishResult.contextWindow.usedContextTokens).toBeLessThanOrEqual(28_000);
  });

  it("installs a structurally complete truncated summary after fitting it to the hard budget", async () => {
    const providerManager = {
      chat: vi.fn(async () => createSummaryResponse(protocolSummary(
        "Continue the task without restarting the session.",
        "oversized context ".repeat(20_000),
      ), "length")),
    };
    const service = createService(providerManager);
    const finishResult = await service.finish(beginCompaction(service).pendingCompaction!);
    const checkpoint = finishResult.timelineMessage?.metadata?.checkpoint as ContextCompactionCheckpoint;

    expect(providerManager.chat).toHaveBeenCalledTimes(1);
    expect(checkpoint).toMatchObject({ status: "compressed" });
    expect(checkpoint.summary).toMatch(/^# Compressed Working Context/);
    expect(checkpoint.summary).toContain("Continuation Contract");
    expect(checkpoint.summary).not.toContain("omitted to fit the checkpoint budget");
    expect(finishResult.contextWindow.usedContextTokens).toBeLessThanOrEqual(28_000);
  });
});
