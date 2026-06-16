import { describe, expect, it } from "vitest";
import {
  resolveChatWelcomeAgents,
  resolveChatWelcomeSelectedAgent,
  resolveChatWelcomeSelectedSessionType,
} from "@/features/chat/features/welcome/utils/chat-welcome-selection.utils";

const agents = [
  { id: "main", displayName: "Main", runtime: "native" },
  { id: "engineer", displayName: "Engineer", runtime: "codex" },
];

describe("chat welcome selection utils", () => {
  it("falls back to the selected agent when agent loading is empty", () => {
    expect(
      resolveChatWelcomeAgents({
        agents: [],
        fallbackAgentId: "main",
      }),
    ).toEqual([{ id: "main" }]);
  });

  it("resolves the selected welcome agent", () => {
    expect(
      resolveChatWelcomeSelectedAgent({
        agents,
        agentId: "engineer",
      })?.runtime,
    ).toBe("codex");
  });

  it("resolves the session type from the selected agent runtime", () => {
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
