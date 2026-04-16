import { describe, expect, it } from "vitest";
import { DefaultNcpStreamEncoder } from "@nextclaw/ncp-agent-runtime";
import { NcpEventType, type NcpEndpointEvent, type OpenAIChatChunk } from "@nextclaw/ncp";

async function collectEventTypes(chunks: OpenAIChatChunk[]): Promise<NcpEventType[]> {
  const encoder = new DefaultNcpStreamEncoder();
  const events: NcpEventType[] = [];

  async function* toStream(): AsyncGenerator<OpenAIChatChunk> {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  for await (const event of encoder.encode(toStream(), {
    sessionId: "session-1",
    messageId: "message-1",
    runId: "run-1",
  })) {
    events.push(event.type);
  }

  return events;
}

async function collectEvents(chunks: OpenAIChatChunk[]): Promise<NcpEndpointEvent[]> {
  const encoder = new DefaultNcpStreamEncoder();
  const events: NcpEndpointEvent[] = [];

  async function* toStream(): AsyncGenerator<OpenAIChatChunk> {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  for await (const event of encoder.encode(toStream(), {
    sessionId: "session-1",
    messageId: "message-1",
    runId: "run-1",
  })) {
    events.push(event);
  }

  return events;
}

describe("DefaultNcpStreamEncoder", () => {
  it("emits reasoning before text when a chunk carries both", async () => {
    const eventTypes = await collectEventTypes([
      {
        choices: [
          {
            delta: {
              reasoning_content: "think first",
              content: "answer after thinking",
            },
            finish_reason: "stop",
          },
        ],
      },
    ]);

    expect(eventTypes).toEqual([
      NcpEventType.MessageReasoningDelta,
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageTextEnd,
    ]);
  });

  it("streams tool call argument deltas before the tool call ends", async () => {
    const events = await collectEvents([
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "tool-edit-1",
                  function: {
                    name: "edit_file",
                    arguments: "{\"path\":\"src/app.ts\",",
                  },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments:
                      "\"oldText\":\"const a = 1;\",\"newText\":\"const a = 2;\"}",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      },
    ]);

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageToolCallStart,
      NcpEventType.MessageToolCallArgsDelta,
      NcpEventType.MessageToolCallArgsDelta,
      NcpEventType.MessageToolCallEnd,
    ]);
    expect(events[1]).toMatchObject({
      type: NcpEventType.MessageToolCallArgsDelta,
      payload: {
        sessionId: "session-1",
        messageId: "message-1",
        toolCallId: "tool-edit-1",
        delta: "{\"path\":\"src/app.ts\",",
      },
    });
    expect(events[2]).toMatchObject({
      type: NcpEventType.MessageToolCallArgsDelta,
      payload: {
        sessionId: "session-1",
        messageId: "message-1",
        toolCallId: "tool-edit-1",
        delta:
          "\"oldText\":\"const a = 1;\",\"newText\":\"const a = 2;\"}",
      },
    });
  });

  it("closes the current text part before tool call events begin", async () => {
    const eventTypes = await collectEventTypes([
      {
        choices: [
          {
            delta: {
              content: "Need tool first. ",
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "tool-search-1",
                  function: {
                    name: "search",
                    arguments: "{\"q\":\"nextclaw\"}",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      },
    ]);

    expect(eventTypes).toEqual([
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageTextEnd,
      NcpEventType.MessageToolCallStart,
      NcpEventType.MessageToolCallArgsDelta,
      NcpEventType.MessageToolCallEnd,
    ]);
  });
});
