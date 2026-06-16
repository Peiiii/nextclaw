import { describe, expect, it } from "vitest";
import {
  resolveChatWelcomeAgents,
  resolveChatWelcomeDraftAgent,
  resolveChatWelcomeDraftProjectRoot,
  resolveChatWelcomeSelectedSessionType,
} from "@/features/chat/features/welcome/utils/chat-welcome-draft.utils";

const agents = [
  { id: "main", displayName: "Main", runtime: "native" },
  { id: "engineer", displayName: "Engineer", runtime: "codex" },
];

describe("chat welcome draft utils", () => {
  it("falls back to the selected draft agent when agent loading is empty", () => {
    expect(
      resolveChatWelcomeAgents({
        agents: [],
        fallbackAgentId: "main",
      }),
    ).toEqual([{ id: "main" }]);
  });

  it("resolves the selected draft agent", () => {
    expect(
      resolveChatWelcomeDraftAgent({
        agents,
        agentId: "engineer",
      })?.runtime,
    ).toBe("codex");
  });

  it("prefers the explicit draft project over the default workspace", () => {
    expect(
      resolveChatWelcomeDraftProjectRoot({
        selectedProjectRoot: "/tmp/project-alpha",
        defaultProjectRoot: "/Users/demo/.nextclaw/workspace",
      }),
    ).toBe("/tmp/project-alpha");
  });

  it("resolves the draft session type from the selected agent runtime", () => {
    expect(
      resolveChatWelcomeSelectedSessionType({
        agents,
        agentId: "engineer",
        defaultSessionType: "native",
        pendingSessionType: null,
        selectedSessionType: null,
        sessionTypeOptions: [
          { value: "native" },
          { value: "codex" },
        ],
      }),
    ).toBe("codex");
  });

  it("prefers an explicit session type over the selected agent runtime", () => {
    expect(
      resolveChatWelcomeSelectedSessionType({
        agents,
        agentId: "engineer",
        defaultSessionType: "native",
        pendingSessionType: "native",
        selectedSessionType: "native",
        sessionTypeOptions: [
          { value: "native" },
          { value: "codex" },
        ],
      }),
    ).toBe("native");
  });
});
