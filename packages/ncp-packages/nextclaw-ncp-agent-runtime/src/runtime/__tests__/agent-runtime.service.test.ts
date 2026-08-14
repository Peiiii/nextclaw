import { describe, expect, it } from "vitest";
import {
  NcpEventType,
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpLLMApi,
  type NcpTool,
  type NcpToolRegistry,
} from "@nextclaw/ncp";
import { DefaultNcpAgentRuntime } from "../agent-runtime.service.js";

describe("DefaultNcpAgentRuntime tool execution timing", () => {
  it("publishes execution start and progress before a timed terminal result", async () => {
    let round = 0;
    const llmApi: NcpLLMApi = {
      generate: async function* () {
        round += 1;
        if (round === 1) {
          yield {
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call-timing",
                      function: {
                        name: "exec",
                        arguments: '{"command":"pwd"}',
                      },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          };
          return;
        }
        yield {
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        };
      },
    };
    const tool: NcpTool = {
      name: "exec",
      execute: async (_args, context) => {
        context?.reportExecutionStarted?.();
        await context?.updateToolCallResult?.({ status: "in_progress" });
        return { ok: true, stdout: "/workspace" };
      },
    };
    const toolRegistry: NcpToolRegistry = {
      getTool: (name) => (name === tool.name ? tool : undefined),
      getToolDefinitions: () => [],
      listTools: () => [tool],
    };
    const appliedEvents: NcpEndpointEvent[] = [];
    const stateManager = {
      dispatch: async (event: NcpEndpointEvent) => {
        appliedEvents.push(event);
      },
      getSnapshot: () => ({ messages: [] }),
    } as unknown as NcpAgentConversationStateManager;
    const runtime = new DefaultNcpAgentRuntime({
      contextBuilder: { prepare: () => ({ messages: [] }) },
      llmApi,
      stateManager,
      toolRegistry,
    });
    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-1",
      messages: [],
    })) {
      events.push(event);
    }

    const startedIndex = events.findIndex(
      (event) => event.type === NcpEventType.MessageToolExecutionStarted,
    );
    const progressIndex = events.findIndex(
      (event) =>
        event.type === NcpEventType.MessageToolCallResult &&
        event.payload.final === false,
    );
    const finalIndex = events.findIndex(
      (event) =>
        event.type === NcpEventType.MessageToolCallResult &&
        event.payload.final === true,
    );
    expect(startedIndex).toBeGreaterThan(-1);
    expect(startedIndex).toBeLessThan(progressIndex);
    expect(progressIndex).toBeLessThan(finalIndex);
    expect(events[finalIndex]).toMatchObject({
      occurredAt: expect.any(String),
      payload: {
        execution: {
          startedAt: expect.any(String),
          endedAt: expect.any(String),
          durationMs: expect.any(Number),
        },
      },
    });
    expect(appliedEvents).toEqual(events);
  });
});
