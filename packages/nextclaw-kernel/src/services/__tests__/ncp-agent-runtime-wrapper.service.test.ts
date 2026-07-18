import { describe, expect, it } from "vitest";
import {
  NcpEventType,
  readNcpAiExecutionMetadata,
  type NcpAgentRunInput,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { NcpAgentRuntimeWrapper } from "@kernel/services/ncp-agent-runtime-wrapper.service";
import type { AgentRunSpec } from "@kernel/types/agent-run.types";
import { SessionRun } from "@kernel/managers/session-run.manager";

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
  runtimeId: "codex",
  agentId: "main",
  model: "deepseek/deepseek-v4-flash",
  requestedModel: null,
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

async function collectWrapperEvents(
  wrapper: NcpAgentRuntimeWrapper,
  sessionRun: SessionRun,
): Promise<NcpEndpointEvent[]> {
  const events: NcpEndpointEvent[] = [];
  for await (const event of wrapper.run(SPEC, {
    contextBlocks: [],
    session: {
      sessionId: "session-1",
      agentRuntimeId: "codex",
      workingDir: "/session/workspace",
      metadata: {},
    },
    sessionRun,
    tools: [],
  })) {
    events.push(event);
  }
  return events;
}

function iterableEvents(events: readonly NcpEndpointEvent[]): AsyncIterable<NcpEndpointEvent> {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

function createRuntimeFailureEvents(messageId: string, message: string): NcpEndpointEvent[] {
  return [
    {
      type: NcpEventType.MessageFailed,
      payload: {
        sessionId: "session-1",
        messageId,
        error: { code: "runtime-error", message },
      },
    },
    {
      type: NcpEventType.RunError,
      payload: {
        sessionId: "session-1",
        messageId,
        runId: "run-1",
        error: message,
      },
    },
  ];
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

  it("forwards external runtime stream failures without adding a wrapper retry layer", async () => {
    const sessionRun = new SessionRun({ sessionId: "session-1", messages: [] });
    sessionRun.inbox.enqueue(createMessage("user-1"));
    let runtimeCreations = 0;
    const wrapper = new NcpAgentRuntimeWrapper({
      createRuntime: () => {
        runtimeCreations += 1;
        return {
          run: (): AsyncIterable<NcpEndpointEvent> => iterableEvents([
            {
              type: NcpEventType.RunStarted,
              payload: { sessionId: "session-1", messageId: "assistant-1", runId: "run-1" },
            },
            {
              type: NcpEventType.MessageTextStart,
              payload: { sessionId: "session-1", messageId: "assistant-1" },
            },
            {
              type: NcpEventType.MessageTextDelta,
              payload: { sessionId: "session-1", messageId: "assistant-1", delta: "partial" },
            },
            ...createRuntimeFailureEvents(
              "assistant-1",
              "Network stream closed before response.completed",
            ),
          ]),
          dispose: async () => undefined,
        };
      },
    });

    const events = await collectWrapperEvents(wrapper, sessionRun);

    expect(runtimeCreations).toBe(1);
    expect(events.map((event) => event.type)).toContain(NcpEventType.MessageFailed);
    expect(events.map((event) => event.type)).toContain(NcpEventType.RunError);
    const metadataIndex = events.findIndex(
      (event) =>
        event.type === NcpEventType.RunMetadata &&
        Boolean(readNcpAiExecutionMetadata(event.payload.metadata)),
    );
    const errorIndex = events.findIndex((event) => event.type === NcpEventType.RunError);
    expect(metadataIndex).toBe(errorIndex - 1);
    expect(
      events[metadataIndex]?.type === NcpEventType.RunMetadata
        ? readNcpAiExecutionMetadata(events[metadataIndex].payload.metadata)
        : null,
    ).toMatchObject({
      runId: "run-1",
      runtimeId: "codex",
      model: "deepseek/deepseek-v4-flash",
      outcome: "failed",
      usage: { status: "unavailable" },
    });
  });
});
