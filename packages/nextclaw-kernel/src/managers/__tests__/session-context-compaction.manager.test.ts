import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CONTEXT_COMPACTION_METADATA_KEY, type ContextCompactionCheckpoint } from "@nextclaw/core";
import { NcpEventType, type NcpMessage, type NcpEndpointEvent } from "@nextclaw/ncp";
import { AgentRunContextCompactionManager } from "@kernel/managers/agent-run-context-compaction.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { SessionRun } from "@kernel/managers/session-run.manager.js";
import { buildContextCompactionTimelineNcpMessage } from "@kernel/features/context-compaction/index.js";
import { SessionContextCompactionManager } from "@kernel/managers/session-context-compaction.manager.js";

const SESSION_ID = "session-context-compaction";

function createHarness(params: {
  compactContext?: () => Promise<{
    events: readonly object[];
    performed: boolean;
    supported: boolean;
  }>;
  exists?: boolean;
  running?: boolean;
} = {}) {
  const sessionRun = {
    applyEvents: vi.fn(async (_events: readonly NcpEndpointEvent[]) => undefined),
    isRunning: () => params.running ?? false,
  };
  const runtime = params.compactContext
    ? { compactContext: params.compactContext }
    : {};
  const eventBus = { emit: vi.fn() };
  const manager = new SessionContextCompactionManager(
    { getOrCreate: vi.fn(() => runtime) } as never,
    eventBus as never,
    {
      getAgentRunSession: vi.fn(async () => ({
        agentRuntimeId: "runtime-1",
        metadata: {},
        sessionId: SESSION_ID,
      })),
      getSession: vi.fn(async () =>
        params.exists === false ? null : { sessionId: SESSION_ID }),
    } as never,
    {
      createSessionRun: vi.fn(async () => sessionRun),
      getSessionRun: vi.fn(() => sessionRun),
    } as never,
  );
  return { eventBus, manager, sessionRun };
}

describe("SessionContextCompactionManager", () => {
  it.each(["empty", "transport"] as const)("persists %s failures, preserves the old checkpoint and succeeds after provider recovery", async kind => {
    const directory = await mkdtemp(join(tmpdir(), "manual-compaction-failure-"));
    const store = new NcpAgentSessionJournalStore(directory);
    try {
      const prior: ContextCompactionCheckpoint = { version: 1, id: "prior", status: "compressed", summary: "Verified prior work.",
        coveredMessageCount: 1, coveredSessionMessageCount: 1, coveredUntil: "2026-11-05T10:00:00.000Z",
        originalEstimatedTokens: 100, projectedEstimatedTokens: 20,
        createdAt: "2026-11-05T10:00:00.000Z", updatedAt: "2026-11-05T10:00:00.000Z" };
      const messages: NcpMessage[] = [buildContextCompactionTimelineNcpMessage({ sessionId: SESSION_ID, messageId: "prior-marker", checkpoint: prior }),
        ...Array.from({ length: 12 }, (_, index): NcpMessage => ({ id: `source-${index}`, sessionId: SESSION_ID,
          role: "assistant", status: "final", timestamp: new Date(Date.UTC(2026, 10, 12, 10, index)).toISOString(),
          parts: [{ type: "text", text: "x".repeat(1200) }] }))];
      const expected = kind === "empty" ? "Empty visible summary" : "provider authentication failed";
      let recovered = false;
      const provider = { chat: vi.fn(async () => {
        if (!recovered && kind === "transport") throw new Error(expected);
        return { content: recovered ? "Continue the verified task." : null, finishReason: "stop", usage: {} };
      }) };
      const agent = new AgentRunContextCompactionManager({ resolveAgentProfileForRun: () => ({ contextTokens: 20000, reservedContextTokens: 2000 }) }, provider);
      const { manager, sessionRun, eventBus } = createHarness({ compactContext: async () => {
        const events = await agent.runManual({ agentId: "main", contextBlocks: [], messages,
          metadata: { [CONTEXT_COMPACTION_METADATA_KEY]: prior }, model: "test", sessionId: SESSION_ID });
        return { events, performed: events.length > 0, supported: true };
      } });
      for (const message of messages) await store.appendSessionEvent({ sessionId: SESSION_ID,
        event: { type: NcpEventType.MessageSent, payload: { sessionId: SESSION_ID, message } } });
      const actor = new SessionRun({ sessionId: SESSION_ID, messages }, undefined, undefined,
        event => store.appendSessionEvent({ sessionId: SESSION_ID, event }));
      sessionRun.applyEvents.mockImplementation(events => actor.applyEvents(events));
      await expect(manager.compact(SESSION_ID)).rejects.toMatchObject({ code: "CONTEXT_COMPACTION_FAILED", message: expected });
      expect(eventBus.emit).toHaveBeenCalledTimes(2);
      const cold = new NcpAgentSessionJournalStore(directory);
      try {
        const restored = await cold.listSessionMessages(SESSION_ID);
        expect(restored.find(message => message.id === "prior-marker")?.metadata?.checkpoint).toEqual(prior);
        const failed = restored.at(-1)!;
        expect(failed.metadata?.checkpoint).toMatchObject({ status: "failed" });
        expect(JSON.stringify(failed)).toContain(expected);
      } finally { cold.close(); }
      recovered = true;
      await expect(manager.compact(SESSION_ID)).resolves.toEqual({ compacted: true, sessionId: SESSION_ID });
      expect(provider.chat).toHaveBeenCalledTimes(2);
    } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
  });
  it("applies and publishes runtime compaction events", async () => {
    const compactContext = vi.fn(async () => ({
      events: [{ type: "message_sent", payload: { sessionId: SESSION_ID } }],
      performed: true,
      supported: true,
    }));
    const { eventBus, manager, sessionRun } = createHarness({ compactContext });

    await expect(manager.compact(SESSION_ID)).resolves.toEqual({
      compacted: true,
      sessionId: SESSION_ID,
    });
    expect(compactContext).toHaveBeenCalledOnce();
    expect(sessionRun.applyEvents).toHaveBeenCalledOnce();
    expect(eventBus.emit).toHaveBeenCalledOnce();
  });

  it("rejects a running session before invoking the runtime", async () => {
    const compactContext = vi.fn(async () => ({
      events: [],
      performed: true,
      supported: true,
    }));
    const { manager } = createHarness({ compactContext, running: true });

    await expect(manager.compact(SESSION_ID)).rejects.toMatchObject({
      code: "SESSION_BUSY",
    });
    expect(compactContext).not.toHaveBeenCalled();
  });

  it("reports missing sessions and unsupported runtimes explicitly", async () => {
    await expect(createHarness({ exists: false }).manager.compact(SESSION_ID)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
    await expect(createHarness().manager.compact(SESSION_ID)).rejects.toMatchObject({
      code: "CONTEXT_COMPACTION_UNSUPPORTED",
    });
  });

  it("reports a successful runtime no-op as nothing to compact", async () => {
    const { manager } = createHarness({
      compactContext: async () => ({
        events: [],
        performed: false,
        supported: true,
      }),
    });

    await expect(manager.compact(SESSION_ID)).rejects.toMatchObject({
      code: "NOTHING_TO_COMPACT",
    });
  });
});
