import type { ItemUpdatedEvent } from "@openai/codex-sdk";
import { NcpEventType } from "@nextclaw/ncp";
import { describe, expect, it } from "vitest";
import {
  mapCodexItemEvent,
  type ItemTextSnapshot,
  type ToolSnapshot,
} from "./codex-sdk-ncp-event-mapper.utils.js";

async function collectMappedEvents(event: ItemUpdatedEvent) {
  const itemTextById = new Map<string, ItemTextSnapshot>();
  const toolStateById = new Map<string, ToolSnapshot>();
  const events = [];

  for await (const mappedEvent of mapCodexItemEvent({
    sessionId: "session-1",
    messageId: "message-1",
    event,
    itemTextById,
    toolStateById,
  })) {
    events.push(mappedEvent);
  }

  return events;
}

describe("mapCodexItemEvent", () => {
  it("streams normal reasoning text", async () => {
    const events = await collectMappedEvents({
      type: "item.updated",
      item: {
        id: "reasoning-1",
        type: "reasoning",
        text: "先分析用户意图，再选择下一步。",
      },
    });

    expect(events).toEqual([
      {
        type: NcpEventType.MessageReasoningStart,
        payload: { sessionId: "session-1", messageId: "message-1" },
      },
      {
        type: NcpEventType.MessageReasoningDelta,
        payload: {
          sessionId: "session-1",
          messageId: "message-1",
          delta: "先分析用户意图，再选择下一步。",
        },
      },
    ]);
  });

  it("does not rewrite reasoning text in the NCP mapper", async () => {
    const events = await collectMappedEvents({
      type: "item.updated",
      item: {
        id: "reasoning-2",
        type: "reasoning",
        text: "Bridge keeps spaces.",
      },
    });

    expect(events).toEqual([
      {
        type: NcpEventType.MessageReasoningStart,
        payload: { sessionId: "session-1", messageId: "message-1" },
      },
      {
        type: NcpEventType.MessageReasoningDelta,
        payload: {
          sessionId: "session-1",
          messageId: "message-1",
          delta: "Bridge keeps spaces.",
        },
      },
    ]);
  });

  it("continues to stream assistant text", async () => {
    const events = await collectMappedEvents({
      type: "item.updated",
      item: {
        id: "message-item-1",
        type: "agent_message",
        text: "done",
      },
    });

    expect(events).toEqual([
      {
        type: NcpEventType.MessageTextStart,
        payload: { sessionId: "session-1", messageId: "message-1" },
      },
      {
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId: "session-1", messageId: "message-1", delta: "done" },
      },
    ]);
  });
});
