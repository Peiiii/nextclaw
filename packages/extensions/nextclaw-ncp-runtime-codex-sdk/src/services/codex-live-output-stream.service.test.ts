import { describe, expect, it } from "vitest";
import {
  CodexLiveOutputStream,
  type CodexLiveOutputEvent,
} from "./codex-live-output-stream.service.js";
import { CodexLiveOutputEventMergeService } from "./codex-live-output-event-merge.service.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("CodexLiveOutputStream", () => {
  it("streams reasoning and text deltas in observer order", async () => {
    const stream = new CodexLiveOutputStream();
    const events: CodexLiveOutputEvent[] = [];
    const reader = (async () => {
      for await (const event of stream.events()) {
        events.push(event);
      }
    })();

    stream.onReasoningDelta("first");
    stream.onTextDelta("A");
    stream.onReasoningDone();
    stream.onTextDelta("B");
    stream.onTextDone();
    stream.onDone();

    await reader;
    expect(events).toEqual([
      { type: "delta", channel: "reasoning", delta: "first" },
      { type: "delta", channel: "text", delta: "A" },
      { type: "end", channel: "reasoning" },
      { type: "delta", channel: "text", delta: "B" },
      { type: "end", channel: "text" },
      { type: "done" },
    ]);
  });

  it("keeps streaming live output after the Codex event iterator ends", async () => {
    const stream = new CodexLiveOutputStream();
    const service = new CodexLiveOutputEventMergeService();
    const events: Array<{ type: string; delta?: string }> = [];
    const streamed = {
      events: (async function* () {
        await sleep(5);
      })(),
    };

    const producer = (async () => {
      stream.onTextDelta("3");
      await sleep(15);
      stream.onTextDelta("9");
      await sleep(15);
      stream.onTextDelta("1");
      stream.onTextDone();
      stream.onDone();
    })();

    for await (const event of service.stream({
      sessionId: "session",
      messageId: "message",
      runId: "run",
      streamed: streamed as never,
      itemTextById: new Map(),
      liveOutputStream: stream,
      toolStateById: new Map(),
      emitEvent: async function* (event) {
        yield event;
      },
      emitRunCompleted: async function* () {
        yield { type: "run.completed", payload: {} } as never;
      },
      handleThreadEvent: async function* () {
        return false;
      },
    })) {
      if (event.type === "message.text-delta") {
        events.push({ type: event.type, delta: event.payload.delta });
      }
    }
    await producer;

    expect(events).toEqual([
      { type: "message.text-delta", delta: "3" },
      { type: "message.text-delta", delta: "9" },
      { type: "message.text-delta", delta: "1" },
    ]);
  });
});
