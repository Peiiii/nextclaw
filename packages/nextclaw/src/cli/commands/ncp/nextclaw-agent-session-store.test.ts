import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "@nextclaw/core";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { NextclawAgentSessionStore } from "./nextclaw-agent-session-store.js";

const tempDirs: string[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-session-store-"));
  tempDirs.push(dir);
  const home = join(dir, "home");
  mkdirSync(home, { recursive: true });
  process.env.NEXTCLAW_HOME = home;
  return dir;
}

afterEach(() => {
  if (originalNextclawHome) {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("NextclawAgentSessionStore", () => {
  it("preserves assistant part order across save/load", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const store = new NextclawAgentSessionStore(sessionManager);
    const sessionId = `session-${randomUUID()}`;

    const record: AgentSessionRecord = {
      sessionId,
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "user-1",
          sessionId,
          role: "user",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [{ type: "text", text: "hello" }],
        },
        {
          id: "assistant-1",
          sessionId,
          role: "assistant",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [
            { type: "reasoning", text: "think" },
            { type: "text", text: "answer" },
            {
              type: "tool-invocation",
              toolCallId: "call-1",
              toolName: "list_dir",
              state: "result",
              args: { path: "." },
              result: { entries: [] },
            },
          ],
        },
      ],
      metadata: {},
    };

    await store.saveSession(record);
    const loaded = await store.getSession(sessionId);

    expect(loaded?.messages[1]?.role).toBe("assistant");
    expect(loaded?.messages[1]?.parts.map((part) => part.type)).toEqual([
      "reasoning",
      "text",
      "tool-invocation",
    ]);
  });

  it("persists session agent ownership separately from metadata", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const store = new NextclawAgentSessionStore(sessionManager);
    const sessionId = `session-${randomUUID()}`;

    await store.saveSession({
      sessionId,
      agentId: "engineer",
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "user-1",
          sessionId,
          role: "user",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [{ type: "text", text: "hello" }],
        },
      ],
      metadata: {
        label: "Engineer Thread",
      },
    });

    const loaded = await store.getSession(sessionId);
    const sessions = await store.listSessions();

    expect(loaded?.agentId).toBe("engineer");
    expect(loaded?.metadata).not.toHaveProperty("agent_id");
    expect(sessions.find((session) => session.sessionId === sessionId)?.agentId).toBe("engineer");
  });

  it("notifies when a session is saved or deleted", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const onSessionUpdated = vi.fn();
    const store = new NextclawAgentSessionStore(sessionManager, {
      onSessionUpdated,
    });
    const sessionId = `session-${randomUUID()}`;

    await store.saveSession({
      sessionId,
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "assistant-1",
          sessionId,
          role: "assistant",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [{ type: "text", text: "done" }],
        },
      ],
      metadata: {},
    });

    expect(onSessionUpdated).toHaveBeenCalledWith(sessionId);
    onSessionUpdated.mockClear();

    await store.deleteSession(sessionId);

    expect(onSessionUpdated).toHaveBeenCalledWith(sessionId);
  });

  it("strips leaked reply tags when saving and loading assistant history", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const store = new NextclawAgentSessionStore(sessionManager);
    const sessionId = `session-${randomUUID()}`;

    const record: AgentSessionRecord = {
      sessionId,
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "assistant-2",
          sessionId,
          role: "assistant",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [{ type: "text", text: "[[reply_to_current]] hello" }],
        },
      ],
      metadata: {},
    };

    await store.saveSession(record);
    const loaded = await store.getSession(sessionId);

    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0]).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "hello" }],
      metadata: {
        reply_to: "assistant-2",
      },
    });
  });

  it("strips leaked reply tags from legacy assistant content during hydration", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const sessionId = `session-${randomUUID()}`;
    const session = sessionManager.getOrCreate(sessionId);

    sessionManager.addMessage(session, "assistant", "[[reply_to: legacy-msg-9]] hello");
    sessionManager.save(session);

    const store = new NextclawAgentSessionStore(sessionManager);
    const loaded = await store.getSession(sessionId);

    expect(loaded?.messages.at(-1)).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "hello" }],
      metadata: {
        reply_to: "legacy-msg-9",
      },
    });
  });

  it("preserves user image file parts across save and load", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const store = new NextclawAgentSessionStore(sessionManager);
    const sessionId = `session-${randomUUID()}`;

    const record: AgentSessionRecord = {
      sessionId,
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "user-image-1",
          sessionId,
          role: "user",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [
            { type: "text", text: "look at this" },
            {
              type: "file",
              name: "hello.png",
              mimeType: "image/png",
              contentBase64: "ZmFrZS1pbWFnZQ==",
              sizeBytes: 12,
            },
          ],
        },
      ],
      metadata: {},
    };

    await store.saveSession(record);
    const loaded = await store.getSession(sessionId);

    expect(loaded?.messages[0]).toMatchObject({
      role: "user",
      parts: [
        { type: "text", text: "look at this" },
        {
          type: "file",
          name: "hello.png",
          mimeType: "image/png",
          contentBase64: "ZmFrZS1pbWFnZQ==",
          sizeBytes: 12,
        },
      ],
    });
  });
});

describe("NextclawAgentSessionStore legacy tool result hydration", () => {
  it("does not let duplicated legacy tool.result json overwrite structured assistant tool results", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const store = new NextclawAgentSessionStore(sessionManager);
    const sessionId = `session-${randomUUID()}`;
    const timestamp = new Date().toISOString();

    await store.saveSession({
      sessionId,
      updatedAt: timestamp,
      messages: [
        {
          id: "assistant-tool-1",
          sessionId,
          role: "assistant",
          status: "final",
          timestamp,
          parts: [
            { type: "text", text: "writing file" },
            {
              type: "tool-invocation",
              toolCallId: "call-1",
              toolName: "command_execution",
              state: "result",
              args: {
                command: "echo done",
              },
              result: {
                status: "completed",
                command: "echo done",
                aggregated_output: "Done!\n",
                exit_code: 0,
              },
            },
          ],
        },
      ],
      metadata: {},
    });

    const session = sessionManager.getIfExists(sessionId);
    if (!session) {
      throw new Error("expected saved session");
    }
    session.events.push({
      seq: session.nextSeq,
      type: "tool.result",
      timestamp,
      data: {
        message: {
          role: "tool",
          name: "command_execution",
          tool_call_id: "call-1",
          content:
            "{\"status\":\"completed\",\"command\":\"echo done\",\"aggregated_output\":\"Done!\\n\",\"exit_code\":0}",
          timestamp,
        },
      },
    });
    session.updatedAt = new Date(timestamp);
    sessionManager.save(session);

    const loaded = await store.getSession(sessionId);
    const assistantMessage = loaded?.messages.find((message) => message.role === "assistant");
    const toolPart = assistantMessage?.parts.find(
      (part) => part.type === "tool-invocation" && part.toolCallId === "call-1",
    );

    expect(toolPart).toMatchObject({
      type: "tool-invocation",
      toolName: "command_execution",
      state: "result",
      result: {
        status: "completed",
        command: "echo done",
        aggregated_output: "Done!\n",
        exit_code: 0,
      },
    });
  });
});
