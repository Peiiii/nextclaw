import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { EventBus, eventKeys } from "@nextclaw/shared";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { SessionManager } from "@kernel/managers/session.manager.js";

vi.mock("@kernel/features/context-compaction/index.js", () => ({
  ContextWindowPreviewManager: class {
    preview = () => null;
  },
}));

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-session-manager-"));
  tempDirs.push(dir);
  return dir;
}

function createConfig(workspace = createTempDir()) {
  return {
    agents: {
      defaults: {
        workspace,
        model: "",
        engine: "native",
        engineConfig: {},
        thinkingDefault: "off",
        models: {},
        contextTokens: 200000,
        maxToolIterations: 1000,
      },
      list: [],
    },
  } as never;
}

function createMessage(params: {
  id: string;
  sessionId: string;
  text: string;
  timestamp?: string;
  role?: NcpMessage["role"];
}): NcpMessage {
  const {
    id,
    role = "user",
    sessionId,
    text,
    timestamp = "2026-05-12T00:00:00.000Z",
  } = params;
  return {
    id,
    sessionId,
    role,
    status: "final",
    parts: [{ type: "text", text }],
    timestamp,
  };
}

function createRecord(params: {
  sessionId: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
  messages?: NcpMessage[];
  createdAt?: string;
  updatedAt?: string;
}): AgentSessionRecord {
  const {
    agentId,
    createdAt = "2026-05-12T00:00:00.000Z",
    messages = [],
    metadata = {},
    sessionId,
    updatedAt = createdAt,
  } = params;
  return {
    sessionId,
    ...(agentId ? { agentId } : {}),
    messages: messages.map((message) => structuredClone(message)),
    createdAt,
    updatedAt,
    metadata: structuredClone(metadata),
  };
}

async function createFixture(
  records: AgentSessionRecord[] = [],
  config: unknown = createConfig(),
) {
  const eventBus = new EventBus();
  const sessionsDir = createTempDir();
  const journalStore = new NcpAgentSessionJournalStore(join(sessionsDir, ".ncp-agent-journal"));
  const handleSessionUpdated = vi.fn();
  const sessionSearch = {
    handleSessionUpdated,
  };
  for (const record of records) {
    await journalStore.importSessionSnapshot(record);
  }
  const manager = new SessionManager({
    agentManager: {
      resolveAgentProfile: () => ({
        workspace: (config as { agents: { defaults: { workspace: string } } }).agents.defaults.workspace,
      }),
    } as never,
    configManager: { loadConfig: () => config } as never,
    eventBus,
    journalStore,
    sessionSearch: sessionSearch as never,
  });
  return {
    eventBus,
    journalStore,
    manager,
    handleSessionUpdated,
  };
}

async function waitForCondition(assertion: () => void | Promise<void>): Promise<void> {
  const deadline = Date.now() + 2_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    }
  }
  if (lastError) {
    throw lastError;
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SessionManager", () => {
  it("serves UI session API from the journal owner", async () => {
    const fixture = await createFixture([
      createRecord({
        sessionId: "session-1",
        agentId: "main",
        metadata: { label: "Before" },
        messages: [createMessage({ id: "user-1", sessionId: "session-1", text: "hello" })],
      }),
    ]);

    const summaries = await fixture.manager.listSessions();
    const messages = await fixture.manager.listSessionMessages("session-1");

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      agentId: "main",
      messageCount: 1,
      metadata: { label: "Before" },
      sessionId: "session-1",
      status: "idle",
    });
    expect(messages[0]).toMatchObject({
      role: "user",
      sessionId: "session-1",
    });
  });

  it("exposes the session working directory from project root or agent workspace", async () => {
    const agentWorkspace = createTempDir();
    const projectRoot = createTempDir();
    const fixture = await createFixture(
      [
        createRecord({
          sessionId: "project-session",
          agentId: "main",
          metadata: { project_root: projectRoot },
        }),
        createRecord({
          sessionId: "workspace-session",
          agentId: "main",
        }),
      ],
      createConfig(agentWorkspace),
    );

    await expect(fixture.manager.getSession("project-session")).resolves.toMatchObject({
      workingDir: projectRoot,
    });
    await expect(fixture.manager.getSession("workspace-session")).resolves.toMatchObject({
      workingDir: agentWorkspace,
    });
    await expect(fixture.manager.listSessions()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: "project-session",
          workingDir: projectRoot,
        }),
        expect.objectContaining({
          sessionId: "workspace-session",
          workingDir: agentWorkspace,
        }),
      ]),
    );
  });

  it("updates metadata and publishes realtime summary events from one owner", async () => {
    const fixture = await createFixture([
      createRecord({
        sessionId: "session-1",
        metadata: { label: "Before" },
      }),
    ]);
    const events: string[] = [];
    fixture.eventBus.subscribeAll((event) => {
      events.push(event.type);
    });

    const updated = await fixture.manager.updateSession("session-1", {
      metadata: { label: "After" },
    });
    await fixture.manager.deleteSession("session-1");

    expect(updated?.metadata).toEqual({ label: "After" });
    expect(fixture.handleSessionUpdated).toHaveBeenCalledWith("session-1");
    expect(events).toEqual([
      "session.metadata.changed",
      "session.updated",
      "session.summary.upsert",
      "session.updated",
      "session.summary.delete",
    ]);
  });

  it("merges session metadata updates without dropping child-session identity", async () => {
    const fixture = await createFixture([
      createRecord({
        sessionId: "child-session-1",
        metadata: {
          label: "Child",
          parent_session_id: "parent-session-1",
          spawned_by_request_id: "request-1",
        },
      }),
    ]);

    const updated = await fixture.manager.updateSession("child-session-1", {
      metadata: {
        last_activity_preview: {
          state: "completed",
          timestamp: "2026-05-23T00:00:00.000Z",
        },
      },
    });

    expect(updated?.metadata).toMatchObject({
      label: "Child",
      parent_session_id: "parent-session-1",
      spawned_by_request_id: "request-1",
      last_activity_preview: {
        state: "completed",
      },
    });
  });

  it("updates activity preview from appended run events", async () => {
    const fixture = await createFixture([
      createRecord({
        sessionId: "session-1",
        metadata: {
          last_activity_preview: {
            state: "running",
            statusText: "正在处理...",
            timestamp: "2026-05-21T00:00:00.000Z",
          },
        },
      }),
    ]);
    fixture.manager.start();

    fixture.eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-1",
        message: createMessage({
          id: "assistant-1",
          role: "assistant",
          sessionId: "session-1",
          text: "final preview text",
          timestamp: "2026-05-21T00:00:01.000Z",
        }),
      },
    });
    fixture.eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });

    await waitForCondition(async () => {
      await expect(fixture.manager.getSession("session-1")).resolves.toMatchObject({
        metadata: {
          last_activity_preview: {
            state: "completed",
            replyText: "final preview text",
          },
        },
      });
    });
    fixture.manager.dispose();
  });

  it("fills completed activity preview from the latest assistant message", async () => {
    const fixture = await createFixture([
      createRecord({
        sessionId: "session-1",
        messages: [
          createMessage({ id: "user-1", sessionId: "session-1", text: "hello" }),
          createMessage({
            id: "assistant-1",
            role: "assistant",
            sessionId: "session-1",
            text: "latest assistant reply",
          }),
        ],
        metadata: {
          last_activity_preview: {
            state: "running",
            statusText: "正在思考",
            timestamp: "2026-05-21T00:00:00.000Z",
          },
        },
      }),
    ]);
    fixture.manager.start();

    fixture.eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        runId: "run-1",
      },
    });

    await waitForCondition(async () => {
      await expect(fixture.manager.getSession("session-1")).resolves.toMatchObject({
        metadata: {
          last_activity_preview: {
            state: "completed",
            replyText: "latest assistant reply",
          },
        },
      });
    });
    fixture.manager.dispose();
  });

  it("keeps the activity preview tool name after tool completion", async () => {
    const fixture = await createFixture([
      createRecord({ sessionId: "session-1" }),
    ]);
    fixture.manager.start();

    fixture.eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        toolCallId: "tool-call-1",
        toolName: "read_file",
      },
    });
    fixture.eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        toolCallId: "tool-call-1",
        content: "ok",
      },
    });

    await waitForCondition(async () => {
      await expect(fixture.manager.getSession("session-1")).resolves.toMatchObject({
        metadata: {
          last_activity_preview: {
            state: "running",
            statusText: "工具调用完成：read_file",
          },
        },
      });
    });
    fixture.manager.dispose();
  });

  it("creates new sessions in the journal instead of legacy SessionManager", async () => {
    const fixture = await createFixture();

    const created = await fixture.manager.createSession({
      task: "Draft run",
      title: "Draft run",
      sourceSessionMetadata: {},
      metadataOverrides: { preferred_model: "openai/gpt-5" },
      sessionType: "native",
    });

    expect(created.sessionId).toMatch(/^ncp-/);
    expect(await fixture.journalStore.getSession(created.sessionId)).toMatchObject({
      sessionId: created.sessionId,
      metadata: {
        label: "Draft run",
        preferred_model: "openai/gpt-5",
      },
    });
  });

  it("creates child sessions with inherited parent context before the tool-call anchor", async () => {
    const anchorMessage = {
      id: "assistant-anchor",
      sessionId: "parent-session",
      role: "assistant",
      status: "streaming",
      timestamp: "2026-05-12T00:00:03.000Z",
      parts: [
        {
          type: "tool-invocation",
          toolName: "sessions_spawn",
          toolCallId: "call-spawn-1",
          state: "call",
          args: { scope: "child", inheritContext: true },
        },
      ],
    } satisfies NcpMessage;
    const fixture = await createFixture([
      createRecord({
        sessionId: "parent-session",
        agentId: "main",
        messages: [
          createMessage({
            id: "user-before",
            sessionId: "parent-session",
            text: "父会话背景",
          }),
          createMessage({
            id: "assistant-before",
            role: "assistant",
            sessionId: "parent-session",
            text: "父会话回答",
            timestamp: "2026-05-12T00:00:01.000Z",
          }),
          anchorMessage,
          createMessage({
            id: "user-after",
            sessionId: "parent-session",
            text: "锚点之后不应继承",
            timestamp: "2026-05-12T00:00:04.000Z",
          }),
        ],
      }),
    ]);

    const created = await fixture.manager.createSession({
      sessionId: "child-session",
      sourceSessionId: "parent-session",
      sourceSessionMetadata: {},
      contextInheritance: { anchorToolCallId: "call-spawn-1" },
      parentSessionId: "parent-session",
      task: "子任务",
    });
    const record = await fixture.journalStore.getSession(created.sessionId);

    expect(created.parentSessionId).toBe("parent-session");
    expect(created.metadata).toMatchObject({
      parent_session_id: "parent-session",
      context_inheritance: {
        enabled: true,
        sourceSessionId: "parent-session",
        anchorKind: "tool_call",
        anchorToolCallId: "call-spawn-1",
        anchorMessageId: "assistant-anchor",
        inheritedMessageCount: 2,
      },
    });
    expect(record?.messages.map((message) => message.id)).toEqual([
      "child-session:inherited:1",
      "child-session:inherited:2",
    ]);
    expect(record?.messages.map((message) => message.sessionId)).toEqual([
      "child-session",
      "child-session",
    ]);
    expect(record?.messages[0]?.metadata).toMatchObject({
      inherited_from_session_id: "parent-session",
      inherited_from_message_id: "user-before",
    });
    expect(record?.messages.map((message) => message.parts)).not.toContainEqual(
      [{ type: "text", text: "锚点之后不应继承" }],
    );
  });

  it("rejects context inheritance without a child parent", async () => {
    const fixture = await createFixture([
      createRecord({ sessionId: "parent-session" }),
    ]);

    await expect(fixture.manager.createSession({
      sourceSessionId: "parent-session",
      sourceSessionMetadata: {},
      contextInheritance: { anchorToolCallId: "call-spawn-1" },
      task: "standalone",
    })).rejects.toThrow("contextInheritance requires a child session parentSessionId.");
  });

  it("internally derives stable agent run sessions from peerId", async () => {
    const fixture = await createFixture();

    const first = await fixture.manager.getOrCreateAgentRunSession({
      agentId: "main",
      metadata: { agent_peer_scope: "panel-app:mood-calendar" },
      peerId: "mood-summary",
      task: "Summarize mood",
    });
    const second = await fixture.manager.getOrCreateAgentRunSession({
      agentId: "main",
      metadata: { agent_peer_scope: "panel-app:mood-calendar" },
      peerId: "mood-summary",
      task: "Continue mood",
    });
    const other = await fixture.manager.getOrCreateAgentRunSession({
      agentId: "main",
      metadata: { agent_peer_scope: "panel-app:other" },
      peerId: "mood-summary",
      task: "Other app",
    });
    const differentPeer = await fixture.manager.getOrCreateAgentRunSession({
      agentId: "main",
      metadata: { agent_peer_scope: "panel-app:mood-calendar" },
      peerId: "todo-summary",
      task: "Summarize todos",
    });

    expect(first.sessionId).toMatch(/^agent-peer-/);
    expect(second.sessionId).toBe(first.sessionId);
    expect(other.sessionId).not.toBe(first.sessionId);
    expect(differentPeer.sessionId).not.toBe(first.sessionId);
    expect(await fixture.journalStore.getSession(first.sessionId)).toMatchObject({
      metadata: {
        agent_peer_id: "mood-summary",
        agent_peer_scope: "panel-app:mood-calendar",
      },
    });
    await expect(fixture.manager.getSession(first.sessionId)).resolves.toMatchObject({
      peerId: "mood-summary",
    });
    await expect(fixture.manager.listSessions()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          peerId: "mood-summary",
          sessionId: first.sessionId,
        }),
      ]),
    );
    const moodSummaries = await fixture.manager.listSessions({ peerId: "mood-summary" });
    expect(moodSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          peerId: "mood-summary",
          sessionId: first.sessionId,
        }),
        expect.objectContaining({
          peerId: "mood-summary",
          sessionId: other.sessionId,
        }),
      ]),
    );
    expect(moodSummaries).toHaveLength(2);
    expect(moodSummaries).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          peerId: "todo-summary",
          sessionId: differentPeer.sessionId,
        }),
      ]),
    );
    await expect(fixture.manager.listSessions({ peerId: "todo-summary" })).resolves.toEqual([
      expect.objectContaining({
        peerId: "todo-summary",
        sessionId: differentPeer.sessionId,
      }),
    ]);
    await expect(fixture.manager.listSessions({ peerId: "missing-peer" })).resolves.toEqual([]);
  });
});

describe("SessionManager agent run child materialization", () => {
  it("creates inherited agent run child sessions from the source session metadata", async () => {
    const projectRoot = createTempDir();
    const fixture = await createFixture([
      createRecord({
        sessionId: "parent-session",
        agentId: "reviewer",
        metadata: {
          runtime: "codex",
          session_type: "codex",
          preferred_model: "openai/gpt-5",
          preferred_thinking: "high",
          project_root: projectRoot,
        },
        messages: [
          createMessage({
            id: "parent-message-1",
            sessionId: "parent-session",
            text: "父会话上下文",
          }),
        ],
      }),
    ]);

    const session = await fixture.manager.getOrCreateAgentRunSession({
      contextInheritance: {},
      parentSessionId: "parent-session",
      sourceSessionId: "parent-session",
      task: "继续讨论",
    });
    const record = await fixture.journalStore.getSession(session.sessionId);

    expect(session).toMatchObject({
      agentId: "reviewer",
      agentRuntimeId: "codex",
      model: "openai/gpt-5",
      projectRoot,
      thinkingEffort: "high",
    });
    expect(record).toMatchObject({
      agentId: "reviewer",
      metadata: {
        parent_session_id: "parent-session",
        runtime: "codex",
        session_type: "codex",
        preferred_model: "openai/gpt-5",
        preferred_thinking: "high",
        project_root: projectRoot,
        context_inheritance: {
          enabled: true,
          sourceSessionId: "parent-session",
          inheritedMessageCount: 1,
        },
      },
    });
    expect(record?.messages).toEqual([
      expect.objectContaining({
        id: `${session.sessionId}:inherited:1`,
        sessionId: session.sessionId,
        metadata: expect.objectContaining({
          inherited_from_session_id: "parent-session",
          inherited_from_message_id: "parent-message-1",
        }),
      }),
    ]);
  });
});

describe("SessionManager runtime metadata", () => {
  it("persists runtime session metadata patches from NCP events", async () => {
    const fixture = await createFixture([
      createRecord({
        sessionId: "codex-session-1",
        metadata: {
          label: "Codex",
          session_type: "codex",
        },
      }),
    ]);
    fixture.manager.start();

    fixture.eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId: "codex-session-1",
        messageId: "assistant-1",
        runId: "run-1",
        metadata: {
          kind: "session_metadata_patch",
          sessionMetadataPatch: {
            codex_thread_id: "thread-persisted-1",
            session_type: "codex",
          },
        },
      },
    });

    await waitForCondition(async () => {
      await expect(fixture.manager.getSession("codex-session-1")).resolves.toMatchObject({
        metadata: {
          label: "Codex",
          session_type: "codex",
          codex_thread_id: "thread-persisted-1",
        },
      });
    });
  });
});
