import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "@nextclaw/core";
import { UiSessionService } from "./ui-session-service.js";

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
  it("lists persisted sessions and messages before the runtime agent is ready", async () => {
    const workspace = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
    const sessionId = `ncp-${randomUUID()}`;
    const session = sessionManager.getOrCreate(sessionId);

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
      messageCount: 2,
      status: "idle",
      metadata: {
        session_type: "native",
        label: "Startup session",
      },
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
});
