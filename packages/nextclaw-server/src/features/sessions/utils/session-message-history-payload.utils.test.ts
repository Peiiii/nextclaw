import { describe, expect, it } from "vitest";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  buildSessionMessageHistoryPayloadView,
  SESSION_HISTORY_TOOL_PAYLOAD_SUMMARY_METADATA_KEY,
} from "./session-message-history-payload.utils.js";

function assistantMessage(id: string, payload: string): NcpMessage {
  return {
    id,
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-08-19T00:00:00.000Z",
    parts: [
      {
        type: "tool-invocation",
        toolCallId: `${id}-tool`,
        toolName: "write_file",
        state: "result",
        args: { path: `/tmp/${id}.txt`, content: payload },
        result: { output: payload },
      },
      { type: "text", text: "done" },
    ],
  };
}

describe("buildSessionMessageHistoryPayloadView", () => {
  it("keeps ordinary tool payloads complete", () => {
    const message = assistantMessage("small", "small");
    const view = buildSessionMessageHistoryPayloadView({
      messages: [message],
      messageDetailCursors: { small: "cursor-small" },
      messageBudgetBytes: 1_000,
      pageBudgetBytes: 1_000,
    });

    expect(view.messages[0]).toBe(message);
    expect(view.deferredToolPayloads).toEqual({});
  });

  it("defers a message whose cumulative tool payload exceeds its budget", () => {
    const message = assistantMessage("large", "x".repeat(500));
    const view = buildSessionMessageHistoryPayloadView({
      messages: [message],
      messageDetailCursors: { large: "cursor-large" },
      messageBudgetBytes: 100,
      pageBudgetBytes: 10_000,
    });
    const tool = view.messages[0]?.parts[0];

    expect(view.deferredToolPayloads).toEqual({ large: { cursor: "cursor-large" } });
    expect(tool).toMatchObject({
      type: "tool-invocation",
      args: undefined,
      result: undefined,
    });
    expect(view.messages[0]?.metadata?.[SESSION_HISTORY_TOOL_PAYLOAD_SUMMARY_METADATA_KEY]).toEqual({
      toolCallCount: 1,
      toolNames: ["write_file"],
    });
    expect(message.parts[0]).toMatchObject({ result: { output: expect.any(String) } });
  });

  it("defers the largest messages until the page returns to budget", () => {
    const largest = assistantMessage("largest", "x".repeat(400));
    const medium = assistantMessage("medium", "x".repeat(250));
    const small = assistantMessage("small", "x".repeat(100));
    const view = buildSessionMessageHistoryPayloadView({
      messages: [largest, medium, small],
      messageDetailCursors: {
        largest: "cursor-largest",
        medium: "cursor-medium",
        small: "cursor-small",
      },
      messageBudgetBytes: 10_000,
      pageBudgetBytes: 900,
    });

    expect(Object.keys(view.deferredToolPayloads)).toEqual(["largest"]);
    expect(view.messages[1]).toBe(medium);
    expect(view.messages[2]).toBe(small);
  });

  it("never defers a message without a stable detail cursor", () => {
    const message = assistantMessage("tail", "x".repeat(500));
    const view = buildSessionMessageHistoryPayloadView({
      messages: [message],
      messageDetailCursors: {},
      messageBudgetBytes: 10,
      pageBudgetBytes: 10,
    });

    expect(view.messages[0]).toBe(message);
    expect(view.deferredToolPayloads).toEqual({});
  });

  it("bounds the real stress shape with many individually small tool calls", () => {
    const payload = "x".repeat(4_096);
    const messages = Array.from({ length: 20 }, (_, messageIndex) => {
      const toolCount = messageIndex === 19 ? 500 : 50;
      const message = assistantMessage(`stress-${messageIndex}`, "seed");
      return {
        ...message,
        parts: [
          ...Array.from({ length: toolCount }, (_, toolIndex) => ({
            type: "tool-invocation" as const,
            toolCallId: `tool-${messageIndex}-${toolIndex}`,
            toolName: "exec_command",
            state: "result" as const,
            args: { request: { nested: { payload } } },
            result: { response: { nested: { payload } } },
          })),
          { type: "text" as const, text: "done" },
        ],
      } satisfies NcpMessage;
    });
    const view = buildSessionMessageHistoryPayloadView({
      messages,
      messageDetailCursors: Object.fromEntries(
        messages.map((message, index) => [message.id, `cursor-${index}`]),
      ),
    });

    expect(Buffer.byteLength(JSON.stringify(view.messages), "utf8")).toBeLessThan(2 * 1024 * 1024);
    expect(Object.keys(view.deferredToolPayloads)).toHaveLength(20);
    expect(view.messages.every(
      (message) => message.parts.filter((part) => part.type === "tool-invocation").length === 1,
    )).toBe(true);
    expect(view.messages[19]?.metadata?.[SESSION_HISTORY_TOOL_PAYLOAD_SUMMARY_METADATA_KEY]).toEqual({
      toolCallCount: 500,
      toolNames: ["exec_command"],
    });
  });
});
