import { describe, expect, it } from "vitest";
import { buildChatWelcomeProjectOptions } from "@/features/chat/features/welcome/utils/chat-welcome-project-options.utils";
import type { NcpSessionSummaryView } from "@/shared/lib/api";

function createSummary(
  overrides: Partial<NcpSessionSummaryView> & { sessionId: string },
): NcpSessionSummaryView {
  return {
    sessionId: overrides.sessionId,
    agentId: "main",
    createdAt: overrides.createdAt ?? "2026-06-10T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-10T10:00:00.000Z",
    lastMessageAt: overrides.lastMessageAt,
    messageCount: 1,
    metadata: overrides.metadata ?? {},
    status: "idle",
  };
}

describe("buildChatWelcomeProjectOptions", () => {
  it("builds recent project options without treating the default workspace as a project", () => {
    const options = buildChatWelcomeProjectOptions({
      defaultProjectRoot: "/Users/demo/.nextclaw/workspace",
      sessionSummaries: [
        createSummary({
          sessionId: "session-default",
          lastMessageAt: "2026-06-12T10:00:00.000Z",
          metadata: { project_root: "/Users/demo/.nextclaw/workspace" },
        }),
        createSummary({
          sessionId: "session-1",
          lastMessageAt: "2026-06-10T10:00:00.000Z",
          metadata: { project_root: "/tmp/project-alpha" },
        }),
        createSummary({
          sessionId: "session-2",
          lastMessageAt: "2026-06-11T10:00:00.000Z",
          metadata: { project_root: "/tmp/project-alpha" },
        }),
      ],
    });

    expect(options).toEqual([
      {
        projectRoot: "/tmp/project-alpha",
        projectName: "project-alpha",
        sessionCount: 2,
      },
    ]);
  });
});
