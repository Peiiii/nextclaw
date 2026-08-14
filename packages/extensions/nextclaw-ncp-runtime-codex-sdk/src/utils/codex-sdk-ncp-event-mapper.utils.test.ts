import type { ItemUpdatedEvent, ThreadEvent } from "@openai/codex-sdk";
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

async function collectMappedEventSequence(
  sequence: Array<Extract<ThreadEvent, { type: "item.started" | "item.updated" | "item.completed" }>>,
) {
  const itemTextById = new Map<string, ItemTextSnapshot>();
  const toolStateById = new Map<string, ToolSnapshot>();
  const events = [];
  for (const event of sequence) {
    for await (const mappedEvent of mapCodexItemEvent({
      sessionId: "session-1",
      messageId: "message-1",
      event,
      itemTextById,
      toolStateById,
    })) {
      events.push(mappedEvent);
    }
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
        occurredAt: expect.any(String),
        type: NcpEventType.MessageReasoningStart,
        payload: { sessionId: "session-1", messageId: "message-1" },
      },
      {
        occurredAt: expect.any(String),
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
        occurredAt: expect.any(String),
        type: NcpEventType.MessageReasoningStart,
        payload: { sessionId: "session-1", messageId: "message-1" },
      },
      {
        occurredAt: expect.any(String),
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
        occurredAt: expect.any(String),
        type: NcpEventType.MessageTextStart,
        payload: { sessionId: "session-1", messageId: "message-1" },
      },
      {
        occurredAt: expect.any(String),
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId: "session-1", messageId: "message-1", delta: "done" },
      },
    ]);
  });

  it("maps command start, progress, and upstream terminal duration without completing early", async () => {
    const startedItem = {
      id: "command-1",
      type: "command_execution" as const,
      command: "pnpm test",
      aggregated_output: "",
      status: "in_progress" as const,
    };
    const events = await collectMappedEventSequence([
      { type: "item.started", item: startedItem },
      { type: "item.updated", item: { ...startedItem, aggregated_output: "running" } },
      {
        type: "item.completed",
        item: {
          ...startedItem,
          aggregated_output: "done",
          exit_code: 0,
          status: "completed",
          durationMs: 0,
        } as typeof startedItem & {
          durationMs: number;
          exit_code: number;
          status: "completed";
        },
      },
    ]);

    const executionStarted = events.find(
      (event) => event.type === NcpEventType.MessageToolExecutionStarted,
    );
    const results = events.filter(
      (event) => event.type === NcpEventType.MessageToolCallResult,
    );
    expect(executionStarted).toMatchObject({
      occurredAt: expect.any(String),
      payload: { messageId: "message-1", toolCallId: "command-1" },
    });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ payload: { final: false } });
    expect(results[1]).toMatchObject({
      payload: {
        final: true,
        execution: {
          startedAt: expect.any(String),
          endedAt: expect.any(String),
          durationMs: 0,
        },
      },
    });
  });
});
