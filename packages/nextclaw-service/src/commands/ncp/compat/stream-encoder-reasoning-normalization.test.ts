import { describe, expect, it } from "vitest";
import { DefaultNcpStreamEncoder } from "@nextclaw/ncp-agent-runtime";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpReasoningDeltaPayload,
  type NcpTextDeltaPayload,
  type OpenAIChatChunk,
} from "@nextclaw/ncp";

async function collectEvents(
  chunks: OpenAIChatChunk[],
  encoder = new DefaultNcpStreamEncoder(),
): Promise<NcpEndpointEvent[]> {
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

describe("DefaultNcpStreamEncoder reasoning normalization", () => {
  it("converts leading think tags into reasoning deltas when the mode is enabled", async () => {
    const events = await collectEvents(
      [
        {
          choices: [
            {
              delta: {
                content: "<thi",
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                content: "nk>inner reasoning",
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                content: "</think><final>visible answer",
              },
              finish_reason: "stop",
            },
          ],
        },
      ],
      new DefaultNcpStreamEncoder({
        reasoningNormalizationMode: "think-tags",
      }),
    );

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageReasoningDelta,
      NcpEventType.MessageReasoningDelta,
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageTextEnd,
    ]);
    expect(
      events
        .filter((event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageReasoningDelta }> => (
          event.type === NcpEventType.MessageReasoningDelta
        ))
        .map((event) => (event.payload as NcpReasoningDeltaPayload).delta)
        .join(""),
    ).toBe("inner reasoning");
    expect(
      events
        .filter((event): event is Extract<NcpEndpointEvent, { type: NcpEventType.MessageTextDelta }> => (
          event.type === NcpEventType.MessageTextDelta
        ))
        .map((event) => (event.payload as NcpTextDeltaPayload).delta)
        .join(""),
    ).toBe("visible answer");
  });
});
