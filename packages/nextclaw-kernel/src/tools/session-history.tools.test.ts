import { describe, expect, it } from "vitest";
import type { NcpMessage, NcpSessionSummary } from "@nextclaw/ncp";
import type { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";
import { SessionsHistoryTool, SessionsListTool } from "./session-history.tools.js";

function createMessage(params: {
  content: string;
  id: string;
  role: NcpMessage["role"];
}): NcpMessage {
  return {
    id: params.id,
    sessionId: "session",
    role: params.role,
    status: "final",
    parts: [{ type: "text", text: params.content }],
    timestamp: "2026-05-23T00:00:00.000Z",
  };
}

function createSessionsFixture(params: {
  messages?: Map<string, NcpMessage[]>;
  summaries: NcpSessionSummary[];
}): NcpSessionManager {
  return {
    getSession: async (sessionId: string) =>
      params.summaries.find((summary) => summary.sessionId === sessionId) ?? null,
    listSessionMessages: async (sessionId: string) =>
      params.messages?.get(sessionId) ?? [],
    listSessions: async (options?: { limit?: number }) =>
      typeof options?.limit === "number"
        ? params.summaries.slice(0, options.limit)
        : params.summaries,
  } as NcpSessionManager;
}

describe("session history tools", () => {
  it("resolves an exact sessions_list query before applying the default limit", async () => {
    const summaries = Array.from({ length: 30 }, (_, index): NcpSessionSummary => ({
      sessionId: `session-${index}`,
      messageCount: 0,
      updatedAt: `2026-05-23T00:${String(index).padStart(2, "0")}:00.000Z`,
      metadata: { label: `Session ${index}` },
    }));
    const tool = new SessionsListTool(createSessionsFixture({ summaries }));

    const result = JSON.parse(await tool.execute({ sessionKey: "session-29" })) as {
      sessions: Array<{ sessionId: string }>;
    };

    expect(result.sessions).toEqual([expect.objectContaining({ sessionId: "session-29" })]);
  });

  it("keeps sessions_history label lookup and includeTools behavior on NCP sessions", async () => {
    const sessionId = "agent:main:slack:direct:user-1";
    const messages = new Map([
      [sessionId, [
        createMessage({ id: "user-1", role: "user", content: "hello" }),
        createMessage({ id: "tool-1", role: "tool", content: "internal" }),
      ]],
    ]);
    const tool = new SessionsHistoryTool(createSessionsFixture({
      messages,
      summaries: [{
        sessionId,
        messageCount: 2,
        updatedAt: "2026-05-23T00:00:00.000Z",
        metadata: { label: "Labeled Session" },
      }],
    }));

    const withoutTools = JSON.parse(await tool.execute({ sessionKey: "Labeled Session" })) as {
      messages: Array<{ role: string }>;
      sessionKey: string;
    };
    const withTools = JSON.parse(await tool.execute({
      includeTools: true,
      sessionKey: "Labeled Session",
    })) as { messages: Array<{ role: string }> };

    expect(withoutTools.sessionKey).toBe(sessionId);
    expect(withoutTools.messages.map((message) => message.role)).toEqual(["user"]);
    expect(withTools.messages.map((message) => message.role)).toEqual(["user", "tool"]);
  });
});
