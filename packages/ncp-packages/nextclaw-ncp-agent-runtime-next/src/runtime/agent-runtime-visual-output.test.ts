import { describe, expect, it } from "vitest";
import { ncpMessageToOpenAiMessages } from "@nextclaw/ncp-agent-runtime";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpLLMApi,
  type NcpLLMApiInput,
  type NcpMessage,
  type NcpTool,
  type OpenAIChatChunk,
} from "@nextclaw/ncp";

import { DefaultNcpAgentRuntime } from "./agent-runtime.service.js";
import type { DefaultNcpAgentRunSpec } from "./types/agent-model-input.types.js";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const spec: DefaultNcpAgentRunSpec = {
  agentId: "main",
  model: "model",
  requestedModel: null,
  runId: "run-1",
  runtimeId: "native",
};

describe("DefaultNcpAgentRuntime visual tool output", () => {
  it("carries view_image tool output into the next model round as image input", async () => {
    const capturedInputs: NcpLLMApiInput[] = [];
    let generateRound = 0;
    const llmApi: NcpLLMApi = {
      generate: async function* (input) {
        capturedInputs.push(input);
        generateRound += 1;
        if (generateRound === 1) {
          yield toolCallChunk(
            0,
            "call-view-image",
            "view_image",
            JSON.stringify({ detail: "original", path: "/tmp/sample.png" })
          );
          yield finishChunk("tool_calls");
          return;
        }

        yield finishChunk("stop");
      },
    };
    const runtime = new DefaultNcpAgentRuntime({
      llmApi,
      modelInputBuilder: {
        build: async (request) => ({
          messages: request.messages.flatMap((message) => ncpMessageToOpenAiMessages(message)),
          model: "model",
        }),
      },
    });
    const { sessionRun } = createRecordingSessionRun();
    const events: NcpEndpointEvent[] = [];

    for await (const event of runtime.run(spec, {
      contextBlocks: [],
      sessionRun,
      tools: [createViewImageTool()],
    })) {
      events.push(event);
    }

    const resultEvent = events.find(
      (event) =>
        event.type === NcpEventType.MessageToolCallResult &&
        event.payload.toolCallId === "call-view-image"
    );
    expect(resultEvent).toMatchObject({
      payload: {
        contentItems: expect.arrayContaining([
          expect.objectContaining({
            imageUrl: `data:image/png;base64,${PNG_BASE64}`,
            type: "input_image",
          }),
        ]),
      },
      type: NcpEventType.MessageToolCallResult,
    });
    expect(capturedInputs).toHaveLength(2);
    const secondInputMessages = capturedInputs[1]?.messages ?? [];
    const visualMessage = secondInputMessages.find(
      (message) => message.role === "user" && Array.isArray(message.content)
    );
    const toolMessage = secondInputMessages.find((message) => message.role === "tool");

    expect(visualMessage).toEqual(expect.objectContaining({
      content: expect.arrayContaining([
        expect.objectContaining({
          image_url: expect.objectContaining({
            url: `data:image/png;base64,${PNG_BASE64}`,
          }),
          type: "image_url",
        }),
      ]),
    }));
    expect(toolMessage?.content).toContain("dataOmitted");
    expect(toolMessage?.content).not.toContain(PNG_BASE64);
  });
});

function createRecordingSessionRun() {
  const messages: NcpMessage[] = [];
  const toolCalls = new Map<string, { argsText: string; toolName: string }>();
  return {
    sessionRun: {
      applyEvents: async (events: readonly NcpEndpointEvent[]) => {
        for (const event of events) {
          if (event.type === NcpEventType.MessageToolCallStart) {
            toolCalls.set(event.payload.toolCallId, {
              argsText: "",
              toolName: event.payload.toolName,
            });
          }
          if (event.type === NcpEventType.MessageToolCallArgs) {
            const current = toolCalls.get(event.payload.toolCallId);
            toolCalls.set(event.payload.toolCallId, {
              argsText: event.payload.args,
              toolName: current?.toolName ?? "unknown",
            });
          }
          if (event.type === NcpEventType.MessageToolCallArgsDelta) {
            const current = toolCalls.get(event.payload.toolCallId);
            toolCalls.set(event.payload.toolCallId, {
              argsText: `${current?.argsText ?? ""}${event.payload.delta}`,
              toolName: current?.toolName ?? "unknown",
            });
          }
          if (event.type === NcpEventType.MessageToolCallResult) {
            messages.push({
              id: `assistant-${event.payload.toolCallId}`,
              parts: [
                {
                  args: parseToolArgsText(toolCalls.get(event.payload.toolCallId)?.argsText ?? "{}"),
                  result: event.payload.content,
                  resultContentItems: event.payload.contentItems,
                  state: "result",
                  toolCallId: event.payload.toolCallId,
                  toolName: toolCalls.get(event.payload.toolCallId)?.toolName ?? "unknown",
                  type: "tool-invocation",
                },
              ],
              role: "assistant",
              sessionId: "session-1",
              status: "streaming",
              timestamp: event.occurredAt ?? "2026-07-05T00:00:00.000Z",
            });
          }
        }
      },
      getSnapshot: () => ({ messages }),
      inbox: {
        drain: () => [],
      },
      sessionId: "session-1",
    },
  };
}

function createViewImageTool(): NcpTool {
  return {
    execute: async (args) => ({
      ok: true,
      path: typeof args === "object" && args !== null ? (args as { path?: unknown }).path : "",
      mimeType: "image/png",
      image: {
        type: "image",
        mimeType: "image/png",
        detail: "original",
        data: PNG_BASE64,
      },
    }),
    name: "view_image",
  };
}

function parseToolArgsText(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toolCallChunk(
  index: number,
  toolCallId: string,
  toolName: string,
  args: string
): OpenAIChatChunk {
  return {
    choices: [
      {
        delta: {
          tool_calls: [
            {
              function: {
                arguments: args,
                name: toolName,
              },
              id: toolCallId,
              index,
            },
          ],
        },
        finish_reason: null,
        index: 0,
      },
    ],
    id: `chunk-${toolCallId}`,
  };
}

function finishChunk(finishReason: "stop" | "tool_calls"): OpenAIChatChunk {
  return {
    choices: [
      {
        delta: {},
        finish_reason: finishReason,
        index: 0,
      },
    ],
    id: `chunk-finish-${finishReason}`,
  };
}
