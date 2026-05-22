import { describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpAgentRuntime, type NcpEndpointEvent } from "@nextclaw/ncp";
import { EventBus } from "@nextclaw/shared";
import {
  InMemoryAgentSessionStore,
  type AgentSessionEventRecord,
  type RuntimeFactoryParams,
} from "@nextclaw/ncp-toolkit";
import { SessionRunManager } from "./session-run.manager.js";
import type { AgentRuntimeManager } from "./agent-runtime.manager.js";

function createRuntimeManagerStub(): AgentRuntimeManager {
  return {
    createRuntime: vi.fn((_params: RuntimeFactoryParams): NcpAgentRuntime => ({
      run: async function* (): AsyncGenerator<never> {},
    })),
    listSessionTypes: vi.fn(() => ({ defaultType: "native", options: [] })),
  } as unknown as AgentRuntimeManager;
}

function createRuntimeManagerCapture(
  onCreate: (params: RuntimeFactoryParams) => void,
): AgentRuntimeManager {
  return {
    createRuntime: vi.fn((params: RuntimeFactoryParams): NcpAgentRuntime => {
      onCreate(params);
      return { run: async function* (): AsyncGenerator<never> {} };
    }),
    listSessionTypes: vi.fn(() => ({ defaultType: "native", options: [] })),
  } as unknown as AgentRuntimeManager;
}

class AppendRecordingSessionStore extends InMemoryAgentSessionStore {
  readonly appendSessionMetadata: Record<string, unknown>[] = [];

  override appendSessionEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { session, updatedAt } = params;
    this.appendSessionMetadata.push(structuredClone(session.metadata ?? {}));
    const existing = await this.getSession(session.sessionId);
    await this.saveSession({
      sessionId: session.sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      messages: existing?.messages ?? [],
      createdAt: existing?.createdAt ?? session.createdAt ?? updatedAt,
      updatedAt,
      metadata: {
        ...(existing?.metadata ? structuredClone(existing.metadata) : {}),
        ...(session.metadata ? structuredClone(session.metadata) : {}),
      },
    });
  };
}

describe("SessionRunManager", () => {
  it("patches live metadata from the in-memory session truth", async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    await sessionStore.saveSession({
      sessionId: "session-1",
      messages: [],
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
      metadata: {},
    });
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerStub(),
      ncpAgentSessionStore: sessionStore,
      eventBus: new EventBus(),
      onSessionUpdated: vi.fn(),
    });
    await manager.getOrCreateLiveSession("session-1");

    const readAtPatch = manager.patchSessionMetadata("session-1", (metadata) => ({
      ...metadata,
      ui_last_read_at: "2026-05-22T00:00:01.000Z",
    }));
    const previewPatch = manager.patchSessionMetadata("session-1", (metadata) => ({
      ...metadata,
      last_activity_preview: {
        state: "running",
        timestamp: "2026-05-22T00:00:02.000Z",
        statusText: "正在调用工具：exec",
      },
    }));
    await Promise.all([readAtPatch, previewPatch]);

    const stored = await sessionStore.getSession("session-1");
    expect(stored?.metadata).toMatchObject({
      ui_last_read_at: "2026-05-22T00:00:01.000Z",
      last_activity_preview: {
        state: "running",
        statusText: "正在调用工具：exec",
      },
    });
    await manager.dispose();
  });

  it("does not send stale live metadata snapshots through event appends for existing sessions", async () => {
    const sessionStore = new AppendRecordingSessionStore();
    await sessionStore.saveSession({
      sessionId: "session-1",
      messages: [],
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
      metadata: { label: "Live session" },
    });
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerStub(),
      ncpAgentSessionStore: sessionStore,
      eventBus: new EventBus(),
      onSessionUpdated: vi.fn(),
    });
    await manager.getOrCreateLiveSession("session-1");
    await manager.patchSessionMetadata("session-1", (metadata) => ({
      ...metadata,
      last_activity_preview: { state: "completed", timestamp: "2026-05-22T00:00:01.000Z" },
    }));

    await manager.appendSessionEvent("session-1", {
      type: NcpEventType.RunFinished,
      payload: { sessionId: "session-1", runId: "run-1" },
    }, { dispatchToStateManager: false });

    const stored = await sessionStore.getSession("session-1");
    expect(sessionStore.appendSessionMetadata).toEqual([{}]);
    expect(stored?.metadata).toMatchObject({
      label: "Live session",
      last_activity_preview: { state: "completed" },
    });
    await manager.dispose();
  });

  it("merges runtime metadata updates without dropping activity preview metadata", async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    await sessionStore.saveSession({
      sessionId: "session-1",
      messages: [],
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
      metadata: {
        last_activity_preview: {
          state: "running",
          timestamp: "2026-05-22T00:00:01.000Z",
        },
      },
    });
    let runtimeParams: RuntimeFactoryParams | null = null;
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerCapture((params) => {
        runtimeParams = params;
      }),
      ncpAgentSessionStore: sessionStore,
      eventBus: new EventBus(),
      onSessionUpdated: vi.fn(),
    });
    await manager.getOrCreateLiveSession("session-1");
    runtimeParams?.setSessionMetadata({ runtime: "native" });
    await manager.appendSessionEvent("session-1", {
      type: NcpEventType.RunFinished,
      payload: { sessionId: "session-1", runId: "run-1" },
    }, { dispatchToStateManager: false });

    const stored = await sessionStore.getSession("session-1");
    expect(stored?.metadata).toMatchObject({
      runtime: "native",
      last_activity_preview: { state: "running" },
    });
    await manager.dispose();
  });

  it("patches stored metadata through the same owner API when the session is not live", async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    await sessionStore.saveSession({
      sessionId: "session-1",
      messages: [],
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
      metadata: { label: "Stored session" },
    });
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerStub(),
      ncpAgentSessionStore: sessionStore,
      eventBus: new EventBus(),
      onSessionUpdated: vi.fn(),
    });

    const patched = await manager.patchSessionMetadata("session-1", (metadata) => ({
      ...metadata,
      last_activity_preview: {
        state: "completed",
        timestamp: "2026-05-22T00:00:01.000Z",
        replyText: "final preview",
      },
    }));

    const stored = await sessionStore.getSession("session-1");
    expect(patched).toBe(true);
    expect(stored?.metadata).toMatchObject({
      label: "Stored session",
      last_activity_preview: {
        state: "completed",
        replyText: "final preview",
      },
    });
    await manager.dispose();
  });
});
