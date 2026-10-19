import { describe, expect, it, vi } from "vitest";
import { CONTEXT_COMPACTION_METADATA_KEY, estimateInputTokens, type ContextCompactionCheckpoint } from "@nextclaw/core";
import { MODEL_ROUND_PART_OFFSETS, ncpMessageToOpenAiMessages } from "@nextclaw/ncp-agent-runtime";
import type { NcpMessage } from "@nextclaw/ncp";
import { buildContextCompactionModelProjection, buildContextCompactionTimelineNcpMessage, readContextRecoveryState } from "@kernel/features/context-compaction/utils/context-compaction.utils.js";
import { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";
import { ContextCompactionSummaryGenerationService } from "./context-compaction-summary-generation.service.js";

const summary = (detail = "Previous operations completed.") => ["# Compressed Working Context",
  "## Active Request\n\nFinish the report.", `## Current Work State\n\nDone: ${detail}`,
  "## Safety and User Constraints\n\nRun each migration once.",
  "## Continuation Contract\n\nReport the result.\n<!-- nextclaw-essential-context-complete -->"].join("\n\n");
const response = (content: string) => ({ content, finishReason: "stop", usage: {} });

describe("compaction continuity boundaries", () => {
  it("keeps recovery required when the provider stops normally but its source text was shortened", async () => {
    const chat = vi.fn(async () => response(summary("A partial but normally terminated summary.")));
    const service = new ContextCompactionPreflightService({ resolveAgentProfileForRun: () => ({ contextTokens: 8_000, reservedContextTokens: 1_000 }) }, { chat });
    const messages: NcpMessage[] = [{ id: "large-source", sessionId: "clipped", role: "assistant", status: "final", timestamp: "2026-10-19T00:00:00.000Z",
      parts: [{ type: "text", text: "old constraints and evidence ".repeat(4_000) }] },
      { id: "current", sessionId: "clipped", role: "user", status: "final", timestamp: "2026-10-19T00:00:01.000Z", parts: [{ type: "text", text: "Continue under the original constraints." }] }];
    const pending = service.begin({ sessionId: "clipped", inputMessages: [], sessionMessages: messages, model: "test", requestMetadata: {}, storedMetadata: {} });
    const completed = await service.finish(pending.pendingCompaction!);
    const checkpoint = completed.timelineMessage!.metadata!.checkpoint as ContextCompactionCheckpoint;
    expect(chat).toHaveBeenCalledOnce();
    expect(checkpoint.summaryDiagnostics).toMatchObject({ sourceTruncated: true, degraded: true, recovery: "provider-summary" });
    expect(readContextRecoveryState([...messages, completed.timelineMessage!]).required).toBe(true);
  });
  it("retains human-confirmed recovery across cold loads and creates a fresh boundary for newly missing evidence", async () => {
    const checkpoint: ContextCompactionCheckpoint = { version: 1, id: "recovery-original", status: "compressed", phase: "pre-run", summary: "Earlier evidence remains archived.",
      coveredUntil: "2026-10-19T00:00:01.000Z", coveredMessageCount: 1, coveredSessionMessageCount: 1, retainedMessageIds: ["archived"],
      originalEstimatedTokens: 100, projectedEstimatedTokens: 30, createdAt: "2026-10-19T00:00:02.000Z", updatedAt: "2026-10-19T00:00:02.000Z",
      recovery: { required: true, reason: "unresolved-archive", archiveThrough: "2026-10-19T00:00:02.000Z" } };
    const archived: NcpMessage = { id: "archived", sessionId: "cold", role: "user", status: "final", parts: [{ type: "text", text: "bounded preview" }],
      timestamp: "2026-10-19T00:00:01.000Z", metadata: { nextclaw_archived_body: true } };
    const marker = buildContextCompactionTimelineNcpMessage({ sessionId: "cold", messageId: "marker", checkpoint });
    const answer: NcpMessage = { id: "answer", sessionId: "cold", role: "user", status: "final", parts: [{ type: "text", text: "Continue only a local report under these conditions." }],
      timestamp: "2026-10-19T00:00:03.000Z", metadata: { nextclaw_context_recovery_ack: checkpoint.id } };
    const messages = [archived, marker, answer];
    const publish = vi.fn();
    const manager = new SessionRunManager({ listSessionMessages: async () => { throw new Error("unbounded fallback"); },
      loadSessionRunSeed: async () => messages, publishSessionEvent: publish });
    const run = await manager.getOrCreateSessionRun("cold");
    expect(run.getContextRecoveryState().required).toBe(false); expect(publish).not.toHaveBeenCalled();
    const provider = { chat: vi.fn(async () => response(summary())) };
    const service = new ContextCompactionPreflightService({ resolveAgentProfileForRun: () => ({ contextTokens: 32_000, reservedContextTokens: 4_000 }) }, provider);
    expect(service.begin({ sessionId: "cold", inputMessages: [], sessionMessages: messages, model: "test", requestMetadata: {}, storedMetadata: {} }).pendingCompaction).toBeNull();
    expect(provider.chat).not.toHaveBeenCalled();
    const newlyArchived = { ...archived, id: "new-archive", timestamp: "2026-10-19T00:00:04.000Z" };
    expect(readContextRecoveryState([...messages, newlyArchived]).required).toBe(true);
    const pending = service.begin({ sessionId: "cold", inputMessages: [], sessionMessages: [...messages, newlyArchived], model: "test", requestMetadata: {},
      storedMetadata: { [CONTEXT_COMPACTION_METADATA_KEY]: checkpoint } });
    const completed = await service.finish(pending.pendingCompaction!);
    const installed = completed.timelineMessage!.metadata!.checkpoint as ContextCompactionCheckpoint;
    expect(installed.recovery?.checkpointId).not.toBe(checkpoint.id);
    expect(readContextRecoveryState([...messages, newlyArchived, completed.timelineMessage!]).required).toBe(true);
    manager.dispose();
  });
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

  it("includes every bounded source identity in one summary request", async () => {
    const provider = { chat: vi.fn(async () => response(summary(`batch-${provider.chat.mock.calls.length}`))) };
    const service = new ContextCompactionSummaryGenerationService(provider);
    const messages = Array.from({ length: 400 }, (_, index) => ({ role: "tool", tool_call_id: `op-${index}`, content: `Completed-${index}` }));
    const generated = await service.generate({ messages, maxInputTokens: 30_000, maxInstallableSummaryTokens: 512,
      maxTokens: 768, targetSummaryTokens: 512, model: "test", requestId: "batch", sessionId: "continuity" });
    expect(provider.chat).toHaveBeenCalledTimes(1);
    const inputs = provider.chat.mock.calls.map((call) => JSON.stringify(call[0].messages));
    for (const message of messages) expect(inputs.some((input) => input.includes(message.tool_call_id))).toBe(true);
    for (const call of provider.chat.mock.calls) expect(estimateInputTokens(call[0].messages)).toBeLessThanOrEqual(30_000);
    expect(generated.diagnostics.sourceBatchCount).toBe(provider.chat.mock.calls.length);
  });

  it("uses deterministic recovery when the identity floor cannot fit and honors cancellation", async () => {
    const messages = Array.from({ length: 300 }, (_, index) => ({ role: "tool", tool_call_id: `op-${index}`, content: "completed" }));
    const provider = { chat: vi.fn(async () => response(provider.chat.mock.calls.length === 1 ? summary() : "partial")) };
    const recovered = await new ContextCompactionSummaryGenerationService(provider).generate({ messages, maxInputTokens: 3_000,
      maxInstallableSummaryTokens: 512, maxTokens: 768, targetSummaryTokens: 512, model: "test", requestId: "batch", sessionId: "continuity" });
    expect(recovered.diagnostics.recovery).toBe("deterministic-recent-context");
    expect(provider.chat).not.toHaveBeenCalled();
    const abort = new AbortController(); abort.abort();
    const untouched = { chat: vi.fn(async () => response(summary())) };
    await expect(new ContextCompactionSummaryGenerationService(untouched).generate({ messages, maxInputTokens: 3_000,
      maxInstallableSummaryTokens: 512, maxTokens: 768, targetSummaryTokens: 512, model: "test", requestId: "batch", sessionId: "continuity", signal: abort.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(untouched.chat).not.toHaveBeenCalled();
  });
});
