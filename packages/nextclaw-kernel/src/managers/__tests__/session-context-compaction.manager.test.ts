import { describe, expect, it, vi } from "vitest";
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
    applyEvents: vi.fn(async () => undefined),
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
