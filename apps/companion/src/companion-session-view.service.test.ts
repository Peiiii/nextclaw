import { describe, expect, it } from "vitest";
import { CompanionSessionViewService } from "./services/companion-session-view.service.js";

describe("CompanionSessionViewService", () => {
  it("prefers the most recently updated running session", () => {
    const service = new CompanionSessionViewService(
      "http://127.0.0.1:55667",
      (agentId) => `http://127.0.0.1:55667/api/agents/${agentId}/avatar`
    );

    const view = service.selectView({
      agents: [{ id: "writer", displayName: "Writer" }],
      sessions: [
        { sessionId: "older", agentId: "writer", messageCount: 1, updatedAt: "2026-05-05T00:00:00.000Z", status: "running" },
        { sessionId: "newer", agentId: "writer", messageCount: 2, updatedAt: "2026-05-06T00:00:00.000Z", status: "running" }
      ]
    });

    expect(view.sessionId).toBe("newer");
    expect(view.title).toBe("Writer");
  });

  it("falls back to an idle shell view when no running session exists", () => {
    const service = new CompanionSessionViewService(
      "http://127.0.0.1:55667",
      () => "http://127.0.0.1:55667/api/agents/default/avatar"
    );

    const view = service.selectView({
      agents: [],
      sessions: []
    });

    expect(view.state).toBe("idle");
    expect(view.subtitle).toBe("No active agent");
  });
});
