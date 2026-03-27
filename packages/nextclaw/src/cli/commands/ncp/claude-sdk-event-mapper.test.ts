import { describe, expect, it } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import {
  createClaudeSdkEventMapperState,
  mapClaudeMessageEvent,
} from "../../../../../extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-sdk-ncp-event-mapper.js";

async function collectEvents(messages: Record<string, unknown>[]) {
  const state = createClaudeSdkEventMapperState();
  const events = [];

  for (const message of messages) {
    for await (const event of mapClaudeMessageEvent({
      sessionId: "session-claude",
      messageId: "message-claude",
      state,
      message,
    })) {
      events.push(event);
    }
  }

  return events;
}

describe("mapClaudeMessageEvent reasoning", () => {
  it("maps Claude thinking stream events into NCP reasoning events", async () => {
    const events = await collectEvents([
      {
        type: "stream_event",
        session_id: "claude-runtime-1",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "thinking",
          },
        },
      },
      {
        type: "stream_event",
        session_id: "claude-runtime-1",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: {
            type: "thinking_delta",
            thinking: "I should inspect the workspace first.",
          },
        },
      },
      {
        type: "stream_event",
        session_id: "claude-runtime-1",
        event: {
          type: "content_block_stop",
          index: 0,
        },
      },
    ]);

    expect(events).toEqual([
      {
        type: NcpEventType.MessageReasoningStart,
        payload: {
          sessionId: "session-claude",
          messageId: "message-claude",
        },
      },
      {
        type: NcpEventType.MessageReasoningDelta,
        payload: {
          sessionId: "session-claude",
          messageId: "message-claude",
          delta: "I should inspect the workspace first.",
        },
      },
      {
        type: NcpEventType.MessageReasoningEnd,
        payload: {
          sessionId: "session-claude",
          messageId: "message-claude",
        },
      },
    ]);
  });
});

describe("mapClaudeMessageEvent tool lifecycle", () => {
  it("maps Claude tool-use stream and synthetic tool-result messages into full tool lifecycle events", async () => {
    const events = await collectEvents([
      {
        type: "stream_event",
        session_id: "claude-runtime-1",
        event: {
          type: "content_block_start",
          index: 1,
          content_block: {
            type: "tool_use",
            id: "tool-123",
            name: "Bash",
            input: {},
          },
        },
      },
      {
        type: "stream_event",
        session_id: "claude-runtime-1",
        event: {
          type: "content_block_delta",
          index: 1,
          delta: {
            type: "input_json_delta",
            partial_json: "{\"command\":\"pwd\"}",
          },
        },
      },
      {
        type: "stream_event",
        session_id: "claude-runtime-1",
        event: {
          type: "content_block_stop",
          index: 1,
        },
      },
      {
        type: "user",
        session_id: "claude-runtime-1",
        parent_tool_use_id: "tool-123",
        tool_use_result: {
          stdout: "/Users/tongwenwen/Projects/Peiiii/nextclaw",
          exitCode: 0,
        },
        message: {
          role: "user",
          content: [],
        },
      },
    ]);

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageToolCallStart,
      NcpEventType.MessageToolCallArgsDelta,
      NcpEventType.MessageToolCallEnd,
      NcpEventType.MessageToolCallResult,
    ]);
    expect(events[0]).toEqual({
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-claude",
        messageId: "message-claude",
        toolCallId: "tool-123",
        toolName: "Bash",
      },
    });
    expect(events[1]).toEqual({
      type: NcpEventType.MessageToolCallArgsDelta,
      payload: {
        sessionId: "session-claude",
        messageId: "message-claude",
        toolCallId: "tool-123",
        delta: "{\"command\":\"pwd\"}",
      },
    });
    expect(events[3]).toEqual({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-claude",
        toolCallId: "tool-123",
        content: {
          stdout: "/Users/tongwenwen/Projects/Peiiii/nextclaw",
          exitCode: 0,
        },
      },
    });
  });
});

describe("mapClaudeMessageEvent snapshot fallback", () => {
  it("falls back to assistant snapshots when Claude returns a completed tool call without partial stream events", async () => {
    const events = await collectEvents([
      {
        type: "assistant",
        session_id: "claude-runtime-1",
        message: {
          content: [
            { type: "text", text: "Done." },
            {
              type: "tool_use",
              id: "tool-fallback",
              name: "Read",
              input: {
                file_path: "/tmp/demo.txt",
              },
            },
          ],
        },
      },
    ]);

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageToolCallStart,
      NcpEventType.MessageToolCallArgs,
      NcpEventType.MessageToolCallEnd,
    ]);
    expect(events[3]).toEqual({
      type: NcpEventType.MessageToolCallArgs,
      payload: {
        sessionId: "session-claude",
        toolCallId: "tool-fallback",
        args: "{\"file_path\":\"/tmp/demo.txt\"}",
      },
    });
  });
});
