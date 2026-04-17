import { describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpEndpointEvent, type NcpMessagePart } from "@nextclaw/ncp";
import { NcpReplyConsumer } from "./ncp-reply-consumer.service.js";
import type { Chat, ChatTarget } from "./chat.types.js";

const target: ChatTarget = {
  conversationId: "conversation-1",
  participantId: "user-1",
};

function createEventStream(
  events: NcpEndpointEvent[],
): AsyncIterable<NcpEndpointEvent> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    },
  };
}

function createChat() {
  const calls: string[] = [];
  const chat: Chat = {
    startTyping: vi.fn(async () => {
      calls.push("startTyping");
    }),
    sendPart: vi.fn(async (_target, part: NcpMessagePart) => {
      calls.push(`sendPart:${part.type}:${"text" in part ? part.text : JSON.stringify(part)}`);
    }),
    sendError: vi.fn(async (_target, message) => {
      calls.push(`sendError:${message}`);
    }),
    stopTyping: vi.fn(async () => {
      calls.push("stopTyping");
    }),
  };

  return { chat, calls };
}

describe("NcpReplyConsumer text streaming", () => {
  it("flushes text parts and sends only the unsent final tail", async () => {
    const { chat, calls } = createChat();
    const consumer = new NcpReplyConsumer(chat);

    await consumer.consume({
      target,
      eventStream: createEventStream([
        {
          type: NcpEventType.MessageTextStart,
          payload: { sessionId: "session-1", messageId: "assistant-1" },
        },
        {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            delta: "Hello",
          },
        },
        {
          type: NcpEventType.MessageTextEnd,
          payload: { sessionId: "session-1", messageId: "assistant-1" },
        },
        {
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId: "session-1",
            message: {
              id: "assistant-1",
              sessionId: "session-1",
              role: "assistant",
              status: "final",
              timestamp: new Date().toISOString(),
              parts: [{ type: "text", text: "Hello world" }],
            },
          },
        },
      ]),
    });

    expect(calls).toEqual([
      "startTyping",
      "sendPart:text:Hello",
      "sendPart:text: world",
      "stopTyping",
    ]);
  });

  it("flushes the current text part before tool calls begin and only sends the missing final tail", async () => {
    const { chat, calls } = createChat();
    const consumer = new NcpReplyConsumer(chat);

    await consumer.consume({
      target,
      eventStream: createEventStream([
        {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            delta: "Need tool",
          },
        },
        {
          type: NcpEventType.MessageToolCallStart,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            toolCallId: "tool-1",
            toolName: "search",
          },
        },
        {
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId: "session-1",
            message: {
              id: "assistant-1",
              sessionId: "session-1",
              role: "assistant",
              status: "final",
              timestamp: new Date().toISOString(),
              parts: [{ type: "text", text: "Need tool done" }],
            },
          },
        },
      ]),
    });

    expect(calls).toEqual([
      "startTyping",
      "sendPart:text:Need tool",
      "sendPart:text: done",
      "stopTyping",
    ]);
  });

  it("skips a duplicated final when the sent blocks already equal the completed text", async () => {
    const { chat, calls } = createChat();
    const consumer = new NcpReplyConsumer(chat);

    await consumer.consume({
      target,
      eventStream: createEventStream([
        {
          type: NcpEventType.MessageTextStart,
          payload: { sessionId: "session-1", messageId: "assistant-1" },
        },
        {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            delta: "Hello ",
          },
        },
        {
          type: NcpEventType.MessageTextEnd,
          payload: { sessionId: "session-1", messageId: "assistant-1" },
        },
        {
          type: NcpEventType.MessageTextStart,
          payload: { sessionId: "session-1", messageId: "assistant-1" },
        },
        {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            delta: "world",
          },
        },
        {
          type: NcpEventType.MessageTextEnd,
          payload: { sessionId: "session-1", messageId: "assistant-1" },
        },
        {
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId: "session-1",
            message: {
              id: "assistant-1",
              sessionId: "session-1",
              role: "assistant",
              status: "final",
              timestamp: new Date().toISOString(),
              parts: [{ type: "text", text: "Hello world" }],
            },
          },
        },
      ]),
    });

    expect(calls).toEqual([
      "startTyping",
      "sendPart:text:Hello ",
      "sendPart:text:world",
      "stopTyping",
    ]);
  });
});

describe("NcpReplyConsumer completed parts", () => {
  it("delivers completed non-text parts through the shared part protocol", async () => {
    const { chat, calls } = createChat();
    const consumer = new NcpReplyConsumer(chat);

    await consumer.consume({
      target,
      eventStream: createEventStream([
        {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            delta: "Hello",
          },
        },
        {
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId: "session-1",
            message: {
              id: "assistant-1",
              sessionId: "session-1",
              role: "assistant",
              status: "final",
              timestamp: new Date().toISOString(),
              parts: [
                { type: "text", text: "Hello" },
                {
                  type: "file",
                  name: "report.pdf",
                  url: "https://example.com/report.pdf",
                },
              ],
            },
          },
        },
      ]),
    });

    expect(calls).toEqual([
      "startTyping",
      "sendPart:text:Hello",
      'sendPart:file:{"type":"file","name":"report.pdf","url":"https://example.com/report.pdf"}',
      "stopTyping",
    ]);
  });

  it("projects asset_put tool results into standard file parts before sending to chat", async () => {
    const { chat, calls } = createChat();
    const consumer = new NcpReplyConsumer(chat);

    await consumer.consume({
      target,
      eventStream: createEventStream([
        {
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId: "session-1",
            message: {
              id: "assistant-1",
              sessionId: "session-1",
              role: "assistant",
              status: "final",
              timestamp: new Date().toISOString(),
              parts: [
                {
                  type: "tool-invocation",
                  toolName: "asset_put",
                  state: "result",
                  result: {
                    ok: true,
                    asset: {
                      uri: "asset://store/2026/04/17/asset_1",
                      name: "output.png",
                      mimeType: "image/png",
                      url: "/api/ncp/assets/content?uri=asset_1",
                      sizeBytes: 5120,
                    },
                  },
                },
              ],
            },
          },
        },
      ]),
    });

    expect(calls).toEqual([
      'startTyping',
      'sendPart:file:{"type":"file","name":"output.png","mimeType":"image/png","assetUri":"asset://store/2026/04/17/asset_1","url":"/api/ncp/assets/content?uri=asset_1","sizeBytes":5120}',
      "stopTyping",
    ]);
  });

  it("projects multiple asset_put results into multiple file parts", async () => {
    const { chat, calls } = createChat();
    const consumer = new NcpReplyConsumer(chat);

    await consumer.consume({
      target,
      eventStream: createEventStream([
        {
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId: "session-1",
            message: {
              id: "assistant-1",
              sessionId: "session-1",
              role: "assistant",
              status: "final",
              timestamp: new Date().toISOString(),
              parts: [
                {
                  type: "tool-invocation",
                  toolName: "asset_put",
                  state: "result",
                  result: {
                    ok: true,
                    assets: [
                      {
                        uri: "asset://store/2026/04/17/asset_a",
                        name: "report-a.pdf",
                        mimeType: "application/pdf",
                        sizeBytes: 101,
                      },
                      {
                        uri: "asset://store/2026/04/17/asset_b",
                        name: "report-b.pdf",
                        mimeType: "application/pdf",
                        sizeBytes: 202,
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      ]),
    });

    expect(calls).toEqual([
      "startTyping",
      'sendPart:file:{"type":"file","name":"report-a.pdf","mimeType":"application/pdf","assetUri":"asset://store/2026/04/17/asset_a","sizeBytes":101}',
      'sendPart:file:{"type":"file","name":"report-b.pdf","mimeType":"application/pdf","assetUri":"asset://store/2026/04/17/asset_b","sizeBytes":202}',
      "stopTyping",
    ]);
  });

  it("sends projected asset_put files immediately on tool-call-result and skips duplicate replay at completed", async () => {
    const { chat, calls } = createChat();
    const consumer = new NcpReplyConsumer(chat);

    await consumer.consume({
      target,
      eventStream: createEventStream([
        {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            delta: "before tool",
          },
        },
        {
          type: NcpEventType.MessageToolCallStart,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            toolCallId: "tool-asset-1",
            toolName: "asset_put",
          },
        },
        {
          type: NcpEventType.MessageToolCallResult,
          payload: {
            sessionId: "session-1",
            toolCallId: "tool-asset-1",
            content: {
              ok: true,
              asset: {
                uri: "asset://store/2026/04/17/asset_streamed",
                name: "streamed.txt",
                mimeType: "text/plain",
                sizeBytes: 12,
              },
            },
          },
        },
        {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            delta: " after tool",
          },
        },
        {
          type: NcpEventType.MessageCompleted,
          payload: {
            sessionId: "session-1",
            message: {
              id: "assistant-1",
              sessionId: "session-1",
              role: "assistant",
              status: "final",
              timestamp: new Date().toISOString(),
              parts: [
                { type: "text", text: "before tool after tool" },
                {
                  type: "tool-invocation",
                  toolCallId: "tool-asset-1",
                  toolName: "asset_put",
                  state: "result",
                  result: {
                    ok: true,
                    asset: {
                      uri: "asset://store/2026/04/17/asset_streamed",
                      name: "streamed.txt",
                      mimeType: "text/plain",
                      sizeBytes: 12,
                    },
                  },
                },
              ],
            },
          },
        },
      ]),
    });

    expect(calls).toEqual([
      "startTyping",
      "sendPart:text:before tool",
      'sendPart:file:{"type":"file","name":"streamed.txt","mimeType":"text/plain","assetUri":"asset://store/2026/04/17/asset_streamed","sizeBytes":12}',
      "sendPart:text: after tool",
      "stopTyping",
    ]);
  });
});

describe("NcpReplyConsumer errors", () => {
  it("reports errors without flushing half-stable text", async () => {
    const { chat, calls } = createChat();
    const consumer = new NcpReplyConsumer(chat);

    await consumer.consume({
      target,
      eventStream: createEventStream([
        {
          type: NcpEventType.MessageTextDelta,
          payload: {
            sessionId: "session-1",
            messageId: "assistant-1",
            delta: "Partial",
          },
        },
        {
          type: NcpEventType.RunError,
          payload: {
            sessionId: "session-1",
            error: "tool failed",
          },
        },
      ]),
    });

    expect(calls).toEqual([
      "startTyping",
      "sendError:tool failed",
      "stopTyping",
    ]);
  });
});
