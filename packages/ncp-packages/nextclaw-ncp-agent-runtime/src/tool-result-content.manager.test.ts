import { describe, expect, it } from "vitest";
import { DefaultNcpContextBuilder } from "./context-builder.js";

describe("tool result content context integration", () => {
  it("restores historical tool image content as a visual observation", () => {
    const builder = new DefaultNcpContextBuilder();
    const prepared = builder.prepare(
      { sessionId: "session-1", messages: [] },
      {
        sessionMessages: [
          {
            id: "assistant-tool-image-1",
            sessionId: "session-1",
            role: "assistant",
            status: "final",
            timestamp: "2026-03-25T12:00:00.000Z",
            parts: [
              {
                type: "tool-invocation",
                toolName: "screenshot",
                toolCallId: "call-image",
                state: "result",
                args: {},
                result: { type: "image", dataOmitted: true },
                resultContentItems: [
                  {
                    type: "input_image",
                    imageUrl: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
                    mimeType: "image/png",
                  },
                ],
              },
            ],
          },
        ],
      },
    );

    expect(prepared.messages).toEqual([
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call-image",
            type: "function",
            function: { name: "screenshot", arguments: "{}" },
          },
        ],
      },
      {
        role: "tool",
        content: '{"type":"image","dataOmitted":true}',
        tool_call_id: "call-image",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: expect.stringContaining('Tool "screenshot" returned 1 image(s).'),
          },
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
            },
          },
        ],
      },
    ]);
  });
});
