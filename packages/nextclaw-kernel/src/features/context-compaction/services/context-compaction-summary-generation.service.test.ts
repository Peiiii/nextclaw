import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateInputTokens } from "@nextclaw/core";
import { COMPACTION_RECOVERY_NOTICE, ContextCompactionSummaryGenerationService } from "./context-compaction-summary-generation.service.js";

const params = {
  maxInputTokens: 15_000, maxInstallableSummaryTokens: 4_000, maxTokens: 4_400,
  messages: Array.from({ length: 12 }, (_, index) => ({ role: "user", content: `source ${index} ${"x".repeat(18_000)}`, ncp_message_id: `message-${index}` })),
  model: "selected-model", requestId: "request-1", sessionId: "session-1", targetSummaryTokens: 4_000,
};
const response = (content: string | null, finishReason = "stop") => ({ content, finishReason, usage: { input_tokens: 100, output_tokens: 50 } });
afterEach(() => vi.useRealTimers());

describe("optional incremental compaction summary", () => {
  it.each(["Continue the task; preserve the verified constraints.", "# 摘要\n已完成读取，尚未执行付款。", "Summary without an HTML marker."])("accepts naturally completed visible text: %s", async text => {
    const provider = { chat: vi.fn(async () => response(text)) };
    const result = await new ContextCompactionSummaryGenerationService(provider).generate(params);
    expect(result.summary).toBe(text);
    expect(result.diagnostics.recovery).toBe("provider-summary");
    expect(provider.chat).toHaveBeenCalledOnce();
    expect(estimateInputTokens(provider.chat.mock.calls[0]![0].messages)).toBeLessThanOrEqual(params.maxInputTokens);
  });

  it.each([
    response(null), response(""), response("<think>hidden reasoning only</think>"),
    response("partial summary", "length"), response("unfinished", "incomplete"),
    response("ignored", "tool_calls"), response("x".repeat(40_000)),
    { ...response("Unexpected tool"), toolCalls: [{}] },
  ])("discards unusable output with one bounded attempt", async value => {
    const provider = { chat: vi.fn(async () => value) };
    const result = await new ContextCompactionSummaryGenerationService(provider).generate(params);
    expect(provider.chat).toHaveBeenCalledOnce();
    expect(result.summary).toBe(COMPACTION_RECOVERY_NOTICE);
    expect(result.diagnostics).toMatchObject({ attemptCount: 1, degraded: true, sourceBatchCount: 1 });
    expect(result.diagnostics.failure).toBeTruthy();
  });

  it("handles the original many-identities failure without partial batch installation", async () => {
    const provider = { chat: vi.fn(async () => response(null)) };
    const result = await new ContextCompactionSummaryGenerationService(provider).generate({ ...params,
      maxInputTokens: 2_000,
      messages: Array.from({ length: 1_500 }, (_, index) => ({ role: "user", content: "Do not repeat completed actions", ncp_message_id: `history-${index}` })),
    });
    expect(provider.chat).not.toHaveBeenCalled();
    expect(result.summary).toBe(COMPACTION_RECOVERY_NOTICE);
    expect(result.diagnostics.recovery).toBe("deterministic-recent-context");
  });

  it("preserves concrete provider configuration and transport errors", async () => {
    const provider = { chat: vi.fn(async () => { throw new Error("provider authentication failed"); }) };
    await expect(new ContextCompactionSummaryGenerationService(provider).generate(params)).rejects.toThrow("provider authentication failed");
    expect(provider.chat).toHaveBeenCalledOnce();
  });

  it("times out an uncooperative transport without waiting for it to honor abort", async () => {
    vi.useFakeTimers();
    const provider = { chat: vi.fn(() => new Promise<ReturnType<typeof response>>(() => {})) };
    const pending = new ContextCompactionSummaryGenerationService(provider).generate(params);
    await vi.advanceTimersByTimeAsync(60_001);
    expect((await pending).diagnostics.failure).toContain("deadline");
    expect(provider.chat).toHaveBeenCalledOnce();
  });

  it("cancels independently of the summary deadline and never produces a candidate", async () => {
    const controller = new AbortController();
    const provider = { chat: vi.fn(() => new Promise<ReturnType<typeof response>>(() => {})) };
    const pending = new ContextCompactionSummaryGenerationService(provider).generate({ ...params, signal: controller.signal });
    controller.abort(new DOMException("Cancelled", "AbortError"));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
