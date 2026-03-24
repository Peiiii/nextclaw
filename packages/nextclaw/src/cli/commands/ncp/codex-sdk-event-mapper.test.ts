import { describe, expect, it } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { mapCodexItemEvent } from "../../../../../extensions/nextclaw-ncp-runtime-codex-sdk/src/codex-sdk-ncp-event-mapper.js";

describe("mapCodexItemEvent", () => {
  it("does not surface non-fatal codex error items as user-visible tool calls", async () => {
    const events = [];
    for await (const event of mapCodexItemEvent({
      sessionId: "session-codex",
      messageId: "message-codex",
      event: {
        type: "item.completed",
        item: {
          id: "item-error",
          type: "error",
          message:
            "Model metadata for `qwen3-coder-next` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.",
        },
      },
      itemTextById: new Map(),
      toolStateById: new Map(),
    })) {
      events.push(event);
    }

    expect(events).toEqual([]);
  });

  it("still maps real tool items into tool-call events", async () => {
    const events = [];
    for await (const event of mapCodexItemEvent({
      sessionId: "session-codex",
      messageId: "message-codex",
      event: {
        type: "item.completed",
        item: {
          id: "cmd-1",
          type: "command_execution",
          command: "echo ok",
          aggregated_output: "ok",
          exit_code: 0,
          status: "completed",
        },
      },
      itemTextById: new Map(),
      toolStateById: new Map(),
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageToolCallStart,
      NcpEventType.MessageToolCallArgs,
      NcpEventType.MessageToolCallEnd,
      NcpEventType.MessageToolCallResult,
    ]);
  });
});
