import { describe, expect, it } from "vitest";
import type { NcpAgentRunInput, NcpEndpointEvent, NcpMessage } from "@nextclaw/ncp";
import { NcpAgentRuntimeWrapper } from "@kernel/services/ncp-agent-runtime-wrapper.service";
import type { AgentRunSpec } from "@kernel/types/agent-run.types";
import type { SessionRun } from "@kernel/managers/session-run.manager";

function createMessage(id: string): NcpMessage {
  return {
    id,
    sessionId: "session-1",
    role: "user",
    status: "final",
    parts: [{ type: "text", text: "hello" }],
    timestamp: "2026-06-15T00:00:00.000Z",
  };
}

function createSessionRun(message: NcpMessage): SessionRun {
  return {
    sessionId: "session-1",
    inbox: {
      drain: () => [message],
    },
    applyEvents: async () => undefined,
  } as unknown as SessionRun;
}

const SPEC: AgentRunSpec = {
  runId: "run-1",
  agentId: "main",
  model: "deepseek/deepseek-v4-flash",
  thinkingEffort: "high",
};

function emptyEvents(): AsyncIterable<NcpEndpointEvent> {
  const events: NcpEndpointEvent[] = [];
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

describe("NcpAgentRuntimeWrapper", () => {
  it("uses refreshed session metadata when reusing the same underlying runtime", async () => {
    const inputs: NcpAgentRunInput[] = [];
    const wrapper = new NcpAgentRuntimeWrapper({
      createRuntime: () => ({
        run: (input: NcpAgentRunInput): AsyncIterable<NcpEndpointEvent> => {
          inputs.push(structuredClone(input));
          return emptyEvents();
        },
      }),
    });

    for await (const _event of wrapper.run(SPEC, {
      contextBlocks: [],
      session: {
        sessionId: "session-1",
        agentRuntimeId: "codex",
        workingDir: "/session/workspace",
        metadata: {
          codex_thread_id: "thread-old",
        },
      },
      sessionRun: createSessionRun(createMessage("user-1")),
      tools: [],
    })) {
      // Drain the wrapper output.
    }
    for await (const _event of wrapper.run(SPEC, {
      contextBlocks: [],
      session: {
        sessionId: "session-1",
        agentRuntimeId: "codex",
        workingDir: "/session/workspace",
        metadata: {
          codex_thread_id: "thread-new",
        },
      },
      sessionRun: createSessionRun(createMessage("user-2")),
      tools: [],
    })) {
      // Drain the wrapper output.
    }

    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.metadata?.codex_thread_id).toBe("thread-old");
    expect(inputs[1]?.metadata?.codex_thread_id).toBe("thread-new");
    expect(inputs[0]?.executionContext?.cwd).toBe("/session/workspace");
    expect(inputs[1]?.executionContext?.cwd).toBe("/session/workspace");
  });
});
