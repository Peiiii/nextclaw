import { beforeEach, describe, expect, it } from "vitest";

import { useCompanionRuntimeStore } from "../stores/companion-runtime.store.js";
import { CompanionRuntimeManager } from "./companion-runtime.manager.js";

describe("CompanionRuntimeManager", () => {
  beforeEach(() => {
    useCompanionRuntimeStore.getState().reset();
  });

  it("prefers the most recently updated running session", () => {
    const manager = new CompanionRuntimeManager();
    const baseUrl = "http://127.0.0.1:55667";

    (manager as unknown as { baseUrl: string | null }).baseUrl = baseUrl;

    const snapshot = manager.syncRuntimeSnapshot({
      agents: [{ id: "writer", displayName: "Writer" }],
      sessions: [
        { sessionId: "older", agentId: "writer", messageCount: 1, updatedAt: "2026-05-05T00:00:00.000Z", status: "running" },
        { sessionId: "newer", agentId: "writer", messageCount: 2, updatedAt: "2026-05-06T00:00:00.000Z", status: "running" }
      ]
    });

    expect(snapshot.currentView.sessionId).toBe("newer");
    expect(snapshot.currentView.title).toBe("Writer");
    expect(snapshot.connectionState).toBe("running");
  });

  it("falls back to an idle shell view when no running session exists", () => {
    const manager = new CompanionRuntimeManager();
    const baseUrl = "http://127.0.0.1:55667";

    (manager as unknown as { baseUrl: string | null }).baseUrl = baseUrl;

    const snapshot = manager.syncRuntimeSnapshot({
      agents: [],
      sessions: []
    });

    expect(snapshot.currentView.state).toBe("idle");
    expect(snapshot.currentView.subtitle).toBe("No active agent");
    expect(snapshot.connectionState).toBe("idle");
  });

  it("produces an offline snapshot with a readable reason", () => {
    const manager = new CompanionRuntimeManager();
    (manager as unknown as { baseUrl: string | null }).baseUrl = "http://127.0.0.1:55667";

    const snapshot = manager.applyOfflineState({ summary: "Cannot reach runtime" });

    expect(snapshot.connectionState).toBe("offline");
    expect(snapshot.currentView.state).toBe("offline");
    expect(snapshot.currentView.subtitle).toBe("Cannot reach runtime");
  });
});
