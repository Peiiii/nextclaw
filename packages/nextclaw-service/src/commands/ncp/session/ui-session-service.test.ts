import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "@nextclaw/core";
import { UiSessionService } from "../ui-session-service.js";

const tempDirs: string[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-session-service-"));
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

describe("UiSessionService", () => {
  it("keeps ui session history in the shared NEXTCLAW_HOME sessions store", async () => {
    const root = createTempWorkspace();
    const workspaceA = join(root, "workspace-a");
    const workspaceB = join(root, "workspace-b");
    mkdirSync(workspaceA, { recursive: true });
    mkdirSync(workspaceB, { recursive: true });

    const sessionId = `ncp-${randomUUID()}`;
    const writer = new SessionManager(workspaceA);
    const session = writer.getOrCreate(sessionId);
    writer.addMessage(session, "user", "hello from shared store");
    writer.save(session);

    const reader = new SessionManager(workspaceB);
    const sessionService = new UiSessionService(reader);
    const sessions = await sessionService.listSessions({ limit: 200 });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId,
      messageCount: 1,
      status: "idle",
    });
  });

  it("lists persisted sessions and messages before the runtime agent is ready", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const sessionId = `ncp-${randomUUID()}`;
    const session = sessionManager.getOrCreate(sessionId);

    session.agentId = "engineer";
    session.metadata = {
      session_type: "native",
      label: "Startup session",
    };
    sessionManager.addMessage(session, "user", "hello");
    sessionManager.addMessage(session, "assistant", "world");
    sessionManager.save(session);

    const sessionService = new UiSessionService(sessionManager);
    const sessions = await sessionService.listSessions({ limit: 200 });
    const messages = await sessionService.listSessionMessages(sessionId, { limit: 300 });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId,
      agentId: "engineer",
      messageCount: 2,
      lastMessageAt: expect.any(String),
      status: "idle",
      metadata: {
        session_type: "native",
        label: "Startup session",
      },
    });
    expect(await sessionService.getSession(sessionId)).toMatchObject({
      sessionId,
      agentId: "engineer",
    });
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
  });

  it("updates and deletes persisted sessions through the ui session service", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const sessionId = `ncp-${randomUUID()}`;
    const session = sessionManager.getOrCreate(sessionId);

    session.metadata = {
      session_type: "native",
      label: "Before update",
    };
    sessionManager.addMessage(session, "user", "hello");
    sessionManager.save(session);

    const onSessionUpdated = vi.fn();
    const sessionService = new UiSessionService(sessionManager, {
      onSessionUpdated,
    });
    const updated = await sessionService.updateSession(sessionId, {
      metadata: {
        session_type: "native",
        label: "After update",
      }
    });

    expect(updated).toMatchObject({
      sessionId,
      metadata: {
        session_type: "native",
        label: "After update",
      },
    });
    expect(onSessionUpdated).toHaveBeenCalledWith(sessionId);

    await sessionService.deleteSession(sessionId);

    expect(onSessionUpdated).toHaveBeenLastCalledWith(sessionId);
    expect(await sessionService.getSession(sessionId)).toBeNull();
  });

  it("upserts a draft session when patching before the first message", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const sessionId = `ncp-${randomUUID()}`;
    const sessionService = new UiSessionService(sessionManager);

    const updated = await sessionService.updateSession(sessionId, {
      metadata: {
        session_type: "codex",
        project_root: "/tmp/project-alpha",
      }
    });

    expect(updated).toMatchObject({
      sessionId,
      messageCount: 0,
      metadata: {
        session_type: "codex",
        project_root: "/tmp/project-alpha",
      },
    });
  });

  it("clears removed metadata keys instead of merging old values back", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const sessionId = `ncp-${randomUUID()}`;
    const session = sessionManager.getOrCreate(sessionId);

    session.metadata = {
      session_type: "codex",
      project_root: "/tmp/project-alpha",
      projectRoot: "/tmp/project-alpha",
      label: "Project session",
    };
    sessionManager.save(session);

    const sessionService = new UiSessionService(sessionManager);
    const updated = await sessionService.updateSession(sessionId, {
      metadata: {
        session_type: "codex",
        label: "Project session",
      }
    });

    expect(updated).toMatchObject({
      sessionId,
      metadata: {
        session_type: "codex",
        label: "Project session",
      },
    });
    expect(updated?.metadata).not.toHaveProperty("project_root");
    expect(updated?.metadata).not.toHaveProperty("projectRoot");
  });
});
