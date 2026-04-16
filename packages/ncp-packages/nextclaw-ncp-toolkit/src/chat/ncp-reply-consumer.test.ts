import { describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpEndpointEvent, type NcpMessagePart } from "@nextclaw/ncp";
import { NcpReplyConsumer } from "./ncp-reply-consumer.js";
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
