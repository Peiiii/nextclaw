import { describe, expect, it, vi } from "vitest";
import { estimateInputTokens, type ContextCompactionCheckpoint } from "@nextclaw/core";
import { MODEL_ROUND_PART_OFFSETS, ncpMessageToOpenAiMessages } from "@nextclaw/ncp-agent-runtime";
import type { NcpMessage } from "@nextclaw/ncp";
import { buildContextCompactionModelProjection } from "@kernel/features/context-compaction/utils/context-compaction.utils.js";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";
import { ContextCompactionSummaryGenerationService } from "./context-compaction-summary-generation.service.js";

const summary = (detail = "Previous operations completed.") => ["# Compressed Working Context",
  "## Active Request\n\nFinish the report.", `## Current Work State\n\nDone: ${detail}`,
  "## Safety and User Constraints\n\nRun each migration once.",
  "## Continuation Contract\n\nReport the result.\n<!-- nextclaw-essential-context-complete -->"].join("\n\n");
const response = (content: string) => ({ content, finishReason: "stop", usage: {} });

describe("compaction continuity boundaries", () => {
  it("freezes retained tool rounds and projects appended parts once across repeated compression", async () => {
    const service = new ContextCompactionPreflightService({ resolveAgentProfileForRun: () => ({
      contextTokens: 20_000, reservedContextTokens: 2_000,
    }) }, { chat: async () => response(summary()) });
    const assistant: NcpMessage = { id: "active", sessionId: "continuity", role: "assistant", status: "streaming",
      timestamp: "2026-10-09T01:00:00.000Z", metadata: { [MODEL_ROUND_PART_OFFSETS]: [1, 2] }, parts: [
        { type: "text", text: "Old investigation ".repeat(4_000) },
        { type: "tool-invocation", state: "result", toolCallId: "migrate", toolName: "exec", args: { cmd: "migrate-once" }, result: "Migration completed" },
        { type: "tool-invocation", state: "result", toolCallId: "verify", toolName: "exec", args: { cmd: "verify-migration" }, result: "Verification passed" },
      ] };
    const first = service.begin({ inputMessages: [], model: "test", phase: "mid-run", trigger: "manual",
      requestMetadata: {}, sessionId: "continuity", sessionMessages: [assistant], storedMetadata: {} });
    const completed = await service.finish(first.pendingCompaction!);
    const checkpoint = completed.timelineMessage!.metadata!.checkpoint as ContextCompactionCheckpoint;
    expect(checkpoint.retainedMessagePartStarts).toEqual({ active: 1 });
    expect(checkpoint.retainedMessagePartEnds).toEqual({ active: 3 });
    const before = buildContextCompactionModelProjection({ sessionId: "continuity", sessionMessages: [assistant, completed.timelineMessage!] });
    assistant.parts.push({ type: "text", text: "NEXT_ACTION_REPORT" });
    const after = buildContextCompactionModelProjection({ sessionId: "continuity", sessionMessages: [assistant, completed.timelineMessage!] });
    expect(after.messages.slice(0, after.stablePrefixMessageCount)).toEqual(before.messages);
    const wire = after.messages.flatMap((message) => ncpMessageToOpenAiMessages(message));
    expect(JSON.stringify(wire).match(/migrate-once/g)).toHaveLength(1);
    expect(JSON.stringify(wire).match(/NEXT_ACTION_REPORT/g)).toHaveLength(1);
    expect(JSON.stringify(wire)).not.toContain("Old investigation");
    const second = service.begin({ inputMessages: [], model: "test", phase: "mid-run", trigger: "manual",
      requestMetadata: {}, sessionId: "continuity", sessionMessages: [assistant, completed.timelineMessage!], storedMetadata: {} });
    const recompressed = await service.finish(second.pendingCompaction!);
    const cold = buildContextCompactionModelProjection({ sessionId: "continuity",
      sessionMessages: structuredClone([assistant, completed.timelineMessage!, recompressed.timelineMessage!]) });
    expect(JSON.stringify(cold.messages.flatMap((message) => ncpMessageToOpenAiMessages(message))).match(/migrate-once/g)).toHaveLength(1);
  });

  it("summarizes every identity batch and carries the completed checkpoint forward", async () => {
    const provider = { chat: vi.fn(async () => response(summary(`batch-${provider.chat.mock.calls.length}`))) };
    const service = new ContextCompactionSummaryGenerationService(provider);
    const messages = Array.from({ length: 400 }, (_, index) => ({ role: "tool", tool_call_id: `op-${index}`, content: `Completed-${index}` }));
    const generated = await service.generate({ messages, maxInputTokens: 3_000, maxInstallableSummaryTokens: 512,
      maxTokens: 768, targetSummaryTokens: 512, model: "test", requestId: "batch", sessionId: "continuity" });
    expect(provider.chat.mock.calls.length).toBeGreaterThan(1);
    const inputs = provider.chat.mock.calls.map((call) => JSON.stringify(call[0].messages));
    for (const message of messages) expect(inputs.some((input) => input.includes(message.tool_call_id))).toBe(true);
    expect(inputs[1]).toContain("batch-1");
    for (const call of provider.chat.mock.calls) expect(estimateInputTokens(call[0].messages)).toBeLessThanOrEqual(3_000);
    expect(generated.diagnostics.sourceBatchCount).toBe(provider.chat.mock.calls.length);
  });

  it("rejects partial batch history and honours cancellation instead of installing it", async () => {
    const messages = Array.from({ length: 300 }, (_, index) => ({ role: "tool", tool_call_id: `op-${index}`, content: "completed" }));
    const provider = { chat: vi.fn(async () => response(provider.chat.mock.calls.length === 1 ? summary() : "partial")) };
    await expect(new ContextCompactionSummaryGenerationService(provider).generate({ messages, maxInputTokens: 3_000,
      maxInstallableSummaryTokens: 512, maxTokens: 768, targetSummaryTokens: 512, model: "test", requestId: "batch", sessionId: "continuity" })).rejects.toThrow();
    const abort = new AbortController(); abort.abort();
    const untouched = { chat: vi.fn(async () => response(summary())) };
    await expect(new ContextCompactionSummaryGenerationService(untouched).generate({ messages, maxInputTokens: 3_000,
      maxInstallableSummaryTokens: 512, maxTokens: 768, targetSummaryTokens: 512, model: "test", requestId: "batch", sessionId: "continuity", signal: abort.signal })).rejects.toThrow("cancelled");
    expect(untouched.chat).not.toHaveBeenCalled();
  });
});
