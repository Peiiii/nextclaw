import { describe, expect, it, vi } from "vitest";
import { estimateInputTokens } from "@nextclaw/core";
import { ContextCompactionSummaryGenerationService } from "./context-compaction-summary-generation.service.js";

function protocolSummary(detail = "Continue the active task."): string {
  return [
    "# Compressed Working Context",
    "## Active Request\n\nPreserve the active request.",
    "## Current Work State\n\nThe current work is in progress.",
    "## Safety and User Constraints\n\nKeep the user's constraints.",
    `## Continuation Contract\n\n${detail}\n<!-- nextclaw-essential-context-complete -->`,
  ].join("\n\n");
}

function response(content: string | null, finishReason = "stop") {
  return {
    content,
    finishReason,
    reasoningContent: null,
    toolCalls: [],
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

function largeMessages(): Record<string, unknown>[] {
  return Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `history ${index} ${"x".repeat(18_000)}`,
    ncp_message_id: `message-${index}`,
  }));
}

const generationParams = {
  maxInputTokens: 15_000,
  maxInstallableSummaryTokens: 4_000,
  maxTokens: 4_400,
  messages: largeMessages(),
  model: "run-selected-model",
  targetSummaryTokens: 4_000,
};

describe("ContextCompactionSummaryGenerationService", () => {
  it("accepts a length response after the essential prefix and drops an unclosed optional tail", async () => {
    const providerManager = {
      chat: vi.fn(async () => response([
        protocolSummary("Continue after the checkpoint."),
        "## Critical Technical Context\n\nKeep the API contract.\n<!-- nextclaw-section-complete:critical-technical-context -->",
        "## Evidence and Verification\n\nThis section was cut off",
      ].join("\n\n"), "length")),
    };
    const service = new ContextCompactionSummaryGenerationService(providerManager as never);

    const generated = await service.generate(generationParams);

    expect(providerManager.chat).toHaveBeenCalledOnce();
    expect(generated.summary).toContain("Critical Technical Context");
    expect(generated.summary).not.toContain("Evidence and Verification");
    expect(generated.diagnostics).toMatchObject({
      attemptCount: 1,
      degraded: true,
      finishReason: "length",
      recovery: "provider-summary",
    });
  });

  it.each([
    {
      name: "truncated non-empty content",
      result: response("# Compressed Working Context\n\nPartial", "length"),
    },
    {
      name: "structurally incomplete content",
      result: response("# Compressed Working Context\n\nPartial"),
    },
    {
      name: "reasoning-only content",
      result: response(null),
    },
    {
      name: "misplaced essential marker",
      result: response(`${protocolSummary()}\n\nunfinished continuation text`, "length"),
    },
  ])("uses deterministic recent context after three $name results", async ({ result }) => {
    const providerManager = { chat: vi.fn(async () => result) };
    const service = new ContextCompactionSummaryGenerationService(providerManager as never);

    const generated = await service.generate(generationParams);

    expect(providerManager.chat).toHaveBeenCalledTimes(3);
    expect(generated.summary).toContain("Exact retained recent source");
    expect(generated.summary).not.toContain("unfinished continuation text");
    expect(generated.diagnostics).toMatchObject({
      attemptCount: 3,
      degraded: true,
      providerUsage: { input_tokens: 300, output_tokens: 150 },
      recovery: "deterministic-recent-context",
    });
  });

  it("strictly shrinks provider input and makes the third call essential-only", async () => {
    const providerManager = {
      chat: vi.fn(async () => providerManager.chat.mock.calls.length < 3
        ? response("# Compressed Working Context\n\n## Active Request\n\npartial", "length")
        : response(protocolSummary("Continue after the reduced retry."))),
    };
    const service = new ContextCompactionSummaryGenerationService(providerManager as never);

    const generated = await service.generate(generationParams);
    const inputSizes = providerManager.chat.mock.calls.map((call) =>
      estimateInputTokens(call[0]?.messages ?? []),
    );

    expect(providerManager.chat).toHaveBeenCalledTimes(3);
    expect(inputSizes[0]).toBeGreaterThan(inputSizes[1] ?? 0);
    expect(inputSizes[1]).toBeGreaterThan(inputSizes[2] ?? 0);
    expect(providerManager.chat.mock.calls[2]?.[0].messages[0]?.content).toContain(
      "final recovery attempt",
    );
    expect(providerManager.chat.mock.calls[2]?.[0].messages[1]?.content).toContain(
      "four essential sections only",
    );
    expect(generated.diagnostics).toMatchObject({
      attemptCount: 3,
      providerUsage: { input_tokens: 300, output_tokens: 150 },
      recovery: "provider-summary",
    });
  });

  it("does not spend semantic retries on provider transport or configuration errors", async () => {
    const providerManager = {
      chat: vi.fn(async () => {
        throw new Error("provider failed");
      }),
    };
    const service = new ContextCompactionSummaryGenerationService(providerManager as never);

    await expect(service.generate(generationParams)).rejects.toThrow("provider failed");
    expect(providerManager.chat).toHaveBeenCalledOnce();
  });

  it("fits deterministic recovery into the minimum supported summary budget", async () => {
    const providerManager = {
      chat: vi.fn(async () => response("# Compressed Working Context\n\nPartial", "length")),
    };
    const service = new ContextCompactionSummaryGenerationService(providerManager as never);

    const generated = await service.generate({
      ...generationParams,
      maxInstallableSummaryTokens: 256,
      targetSummaryTokens: 256,
    });

    expect(generated.diagnostics.recovery).toBe("deterministic-recent-context");
    expect(estimateInputTokens(generated.summary)).toBeLessThanOrEqual(256);
  });
});
