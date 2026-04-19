import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGlobalTypedEventBus,
  SessionManager,
} from "@nextclaw/core";
import { NcpEventType } from "@nextclaw/ncp";
import { NcpLifecycleEventBridge } from "./ncp-lifecycle-event-bridge.service.js";
import {
  agentRunFinishedLifecycleEventKey,
  agentSessionUpdatedLifecycleEventKey,
} from "./ncp-lifecycle-event.config.js";

const tempDirs: string[] = [];

function createSessionManager(): SessionManager {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-lifecycle-bridge-"));
  tempDirs.push(dir);
  return new SessionManager({
    sessionsDir: dir,
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("NcpLifecycleEventBridge", () => {
  it("projects run finished events into the global typed event bus", () => {
    const sessionManager = createSessionManager();
    const session = sessionManager.getOrCreate("root-session");
    session.metadata = {
      session_type: "native",
      parent_session_id: "parent-session",
    };
    sessionManager.save(session);

    const eventBus = createGlobalTypedEventBus();
    const listener = vi.fn();
    const bridge = new NcpLifecycleEventBridge(sessionManager, eventBus);
    eventBus.on(agentRunFinishedLifecycleEventKey, listener);

    bridge.handleEndpointEvent({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "root-session",
        runId: "run-1",
        messageId: "msg-1",
      },
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "root-session",
        sessionType: "native",
        parentSessionId: "parent-session",
        isChildSession: true,
        runId: "run-1",
        messageId: "msg-1",
      }),
    );
  });

  it("publishes session.updated with child-session context", () => {
    const sessionManager = createSessionManager();
    const session = sessionManager.getOrCreate("session-1");
    session.metadata = {
      parent_session_id: "root-session",
    };
    sessionManager.save(session);

    const eventBus = createGlobalTypedEventBus();
    const listener = vi.fn();
    const bridge = new NcpLifecycleEventBridge(sessionManager, eventBus);
    eventBus.on(agentSessionUpdatedLifecycleEventKey, listener);

    bridge.publishSessionUpdated("session-1");

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        parentSessionId: "root-session",
        isChildSession: true,
      }),
    );
  });
});
